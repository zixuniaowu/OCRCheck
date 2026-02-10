"""
OCR Worker - Main entry point.
Polls Redis queue for document processing jobs, runs OCR pipeline,
and stores results back to PostgreSQL + S3.

Usage:
    python -m app.workers.ocr_worker
"""

import logging
import signal
import sys
import time

import boto3
from botocore.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models.document import Document, DocumentStatus
from app.models.ocr_result import OCRPage
from app.services.queue import dequeue_job
from app.workers.pdf_processor import prepare_images, image_to_bytes
from app.workers.ocr_processor import process_page

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ocr_worker")

# Synchronous DB engine for worker
sync_db_url = settings.database_url.replace("+asyncpg", "+psycopg2")
engine = create_engine(sync_db_url)
SessionLocal = sessionmaker(bind=engine)

# S3 client
s3_config = Config(s3={"addressing_style": "path"}, signature_version="s3v4")
s3_client = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint_url,
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key,
    config=s3_config,
    region_name=settings.s3_region,
)

# Graceful shutdown
shutdown_flag = False


def handle_signal(signum, frame):
    global shutdown_flag
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    shutdown_flag = True


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def download_from_s3(s3_key: str) -> bytes:
    resp = s3_client.get_object(Bucket=settings.s3_bucket_name, Key=s3_key)
    return resp["Body"].read()


def upload_to_s3(s3_key: str, data: bytes, content_type: str = "image/png"):
    s3_client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=s3_key,
        Body=data,
        ContentType=content_type,
    )


def run_ai_analysis(doc: Document, ocr_text: str, images: list, db):
    """Run AI analysis on the document after OCR."""
    from app.services.ai_service import analyze_document_text, analyze_document_with_image

    if not settings.ai_enabled or not settings.anthropic_api_key:
        logger.info("AI analysis skipped (disabled or no API key)")
        return

    logger.info(f"Starting AI analysis for: {doc.original_filename}")

    try:
        # Try vision analysis with first page image if available
        result = None
        if images:
            first_page_bytes = image_to_bytes(images[0])
            result = analyze_document_with_image(ocr_text, first_page_bytes)

        # Fall back to text-only analysis
        if result is None:
            result = analyze_document_text(ocr_text)

        if result is None:
            logger.warning("AI analysis returned no result")
            return

        # Store AI results in document
        doc.category = result.get("category")
        doc.category_confidence = result.get("category_confidence")
        doc.summary = result.get("summary")
        doc.tags = result.get("tags", [])
        doc.entities = result.get("entities", {})
        doc.document_date = result.get("document_date")
        doc.key_points = result.get("key_points", [])
        doc.ai_raw_response = result
        db.commit()

        logger.info(
            f"AI analysis done: category={doc.category} "
            f"(confidence={doc.category_confidence}), "
            f"tags={doc.tags}, entities_count="
            f"{sum(len(v) for v in (doc.entities or {}).values() if isinstance(v, list))}"
        )

    except Exception as e:
        logger.exception(f"AI analysis failed: {e}")
        # Don't fail the whole document processing


def index_to_opensearch(doc: Document):
    """Index the document in OpenSearch for full-text search."""
    try:
        from app.services.search import index_document, ensure_index
        ensure_index()
        index_document(
            document_id=str(doc.id),
            original_filename=doc.original_filename,
            content_type=doc.content_type,
            ocr_text=doc.ocr_text,
            summary=doc.summary,
            category=doc.category,
            tags=doc.tags,
            entities=doc.entities,
            key_points=doc.key_points,
            document_date=doc.document_date,
            page_count=doc.page_count,
            file_size=doc.file_size,
            created_at=doc.created_at.isoformat() if doc.created_at else None,
        )
    except Exception as e:
        logger.exception(f"OpenSearch indexing failed: {e}")
        # Don't fail the whole document processing


def process_document(document_id: str):
    """Process a single document through the OCR pipeline."""
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found")
            return

        if doc.status not in (DocumentStatus.UPLOADED, DocumentStatus.FAILED):
            logger.info(f"Document {document_id} status is {doc.status}, skipping")
            return

        # Mark as processing
        doc.status = DocumentStatus.PROCESSING
        db.commit()
        logger.info(f"Processing document: {doc.original_filename} ({document_id})")

        # Download file from S3
        file_bytes = download_from_s3(doc.s3_key)
        logger.info(f"Downloaded {len(file_bytes)} bytes from S3: {doc.s3_key}")

        # Convert to images
        images = prepare_images(file_bytes, doc.content_type)
        page_count = len(images)
        logger.info(f"Converted to {page_count} page(s)")

        # Process each page
        all_texts = []
        for page_num, img in enumerate(images, start=1):
            logger.info(f"Processing page {page_num}/{page_count}")

            # Run OCR + table extraction
            page_result = process_page(img, extract_table=True)

            # Save page image to S3
            page_s3_key = f"{doc.s3_key.rsplit('.', 1)[0]}/pages/{page_num:04d}.png"
            page_img_bytes = image_to_bytes(img)
            upload_to_s3(page_s3_key, page_img_bytes)

            # Save page OCR result to DB
            ocr_page = OCRPage(
                document_id=doc.id,
                page_number=page_num,
                width=page_result["width"],
                height=page_result["height"],
                full_text=page_result["full_text"],
                blocks=page_result["blocks"],
                tables=page_result["tables"],
                page_image_s3_key=page_s3_key,
                confidence=page_result["confidence"],
            )
            db.add(ocr_page)

            if page_result["full_text"]:
                all_texts.append(page_result["full_text"])

            logger.info(
                f"Page {page_num}: {len(page_result['blocks'])} text blocks, "
                f"{len(page_result['tables'])} tables, "
                f"confidence={page_result['confidence']:.2%}"
            )

        # Update document with aggregated OCR text
        full_ocr_text = "\n\n--- Page Break ---\n\n".join(all_texts)
        doc.ocr_text = full_ocr_text
        doc.page_count = page_count
        db.commit()

        logger.info(f"OCR done: {doc.original_filename} — {page_count} pages")

        # --- Phase 3: AI Analysis ---
        run_ai_analysis(doc, full_ocr_text, images, db)

        # --- Phase 4: Index in OpenSearch ---
        index_to_opensearch(doc)

        doc.status = DocumentStatus.COMPLETED
        db.commit()

        logger.info(f"Completed: {doc.original_filename} — {page_count} pages processed")

    except Exception as e:
        logger.exception(f"Failed to process document {document_id}: {e}")
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def main():
    logger.info("OCR Worker started. Waiting for jobs...")

    # Create tables if needed
    from app.db.database import Base
    from app.models.ocr_result import OCRPage  # ensure model is registered
    Base.metadata.create_all(bind=engine)

    while not shutdown_flag:
        job = dequeue_job(timeout=5)
        if job is None:
            continue

        job_type = job.get("type")
        if job_type == "ocr":
            document_id = job.get("document_id")
            if document_id:
                try:
                    process_document(document_id)
                except Exception as e:
                    logger.exception(f"Unhandled error processing {document_id}: {e}")
        else:
            logger.warning(f"Unknown job type: {job_type}")

    logger.info("OCR Worker stopped.")


if __name__ == "__main__":
    main()
