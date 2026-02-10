import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    DocumentListResponse,
    DocumentResponse,
    OCRCorrectionRequest,
    OCRPageResponse,
    ShareRequest,
    ShareResponse,
    UploadResponse,
)
from app.config import settings
from app.db.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.ocr_result import OCRPage
from app.services.queue import enqueue_ocr_job
from app.services.storage import storage_service

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/bmp",
}


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile, db: AsyncSession = Depends(get_db)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. "
            f"Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    file_data = await file.read()
    file_size = len(file_data)
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {file_size} bytes. Max: {max_size} bytes",
        )

    s3_key = storage_service.generate_s3_key(file.filename)
    await storage_service.upload_file(s3_key, file_data, file.content_type)

    document = Document(
        filename=s3_key.split("/")[-1],
        original_filename=file.filename,
        content_type=file.content_type,
        file_size=file_size,
        s3_key=s3_key,
        status=DocumentStatus.UPLOADED,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Enqueue OCR processing job
    await enqueue_ocr_job(str(document.id))

    return UploadResponse(
        id=document.id,
        filename=document.original_filename,
        status=document.status,
        message="File uploaded successfully. OCR processing queued.",
    )


@router.post("/upload-batch", response_model=list[UploadResponse])
async def upload_documents_batch(
    files: list[UploadFile], db: AsyncSession = Depends(get_db)
):
    results = []
    for file in files:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            results.append(
                UploadResponse(
                    id=uuid.uuid4(),
                    filename=file.filename,
                    status=DocumentStatus.FAILED,
                    message=f"Unsupported file type: {file.content_type}",
                )
            )
            continue

        file_data = await file.read()
        file_size = len(file_data)
        max_size = settings.max_upload_size_mb * 1024 * 1024
        if file_size > max_size:
            results.append(
                UploadResponse(
                    id=uuid.uuid4(),
                    filename=file.filename,
                    status=DocumentStatus.FAILED,
                    message=f"File too large: {file_size} bytes",
                )
            )
            continue

        s3_key = storage_service.generate_s3_key(file.filename)
        await storage_service.upload_file(s3_key, file_data, file.content_type)

        document = Document(
            filename=s3_key.split("/")[-1],
            original_filename=file.filename,
            content_type=file.content_type,
            file_size=file_size,
            s3_key=s3_key,
            status=DocumentStatus.UPLOADED,
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)

        await enqueue_ocr_job(str(document.id))

        results.append(
            UploadResponse(
                id=document.id,
                filename=document.original_filename,
                status=document.status,
                message="File uploaded successfully. OCR processing queued.",
            )
        )
    return results


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    status: DocumentStatus | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Document).order_by(Document.created_at.desc())
    count_query = select(func.count(Document.id))

    if status:
        query = query.where(Document.status == status)
        count_query = count_query.where(Document.status == status)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    documents = result.scalars().all()

    doc_responses = []
    for doc in documents:
        url = await storage_service.get_presigned_url(doc.s3_key)
        resp = DocumentResponse.model_validate(doc)
        resp.download_url = url
        doc_responses.append(resp)

    return DocumentListResponse(documents=doc_responses, total=total)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    url = await storage_service.get_presigned_url(document.s3_key)
    resp = DocumentResponse.model_validate(document)
    resp.download_url = url
    return resp


@router.delete("/{document_id}")
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    await storage_service.delete_file(document.s3_key)
    await db.delete(document)
    await db.commit()

    # Remove from search index
    try:
        from app.services.search import delete_document as search_delete
        search_delete(str(document_id))
    except Exception:
        pass

    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/ocr", response_model=list[OCRPageResponse])
async def get_ocr_results(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get per-page OCR results for a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    pages_result = await db.execute(
        select(OCRPage)
        .where(OCRPage.document_id == document_id)
        .order_by(OCRPage.page_number)
    )
    pages = pages_result.scalars().all()

    responses = []
    for page in pages:
        resp = OCRPageResponse.model_validate(page)
        if page.page_image_s3_key:
            resp.page_image_url = await storage_service.get_presigned_url(
                page.page_image_s3_key
            )
        responses.append(resp)

    return responses


@router.get("/{document_id}/ocr/{page_number}", response_model=OCRPageResponse)
async def get_ocr_page(
    document_id: uuid.UUID, page_number: int, db: AsyncSession = Depends(get_db)
):
    """Get OCR result for a specific page."""
    result = await db.execute(
        select(OCRPage).where(
            OCRPage.document_id == document_id,
            OCRPage.page_number == page_number,
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="OCR page not found")

    resp = OCRPageResponse.model_validate(page)
    if page.page_image_s3_key:
        resp.page_image_url = await storage_service.get_presigned_url(
            page.page_image_s3_key
        )
    return resp


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Re-queue a document for OCR processing."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete existing OCR results
    await db.execute(
        select(OCRPage).where(OCRPage.document_id == document_id).execution_options(
            synchronize_session=False
        )
    )
    from sqlalchemy import delete
    await db.execute(delete(OCRPage).where(OCRPage.document_id == document_id))

    document.status = DocumentStatus.UPLOADED
    document.ocr_text = None
    document.page_count = None
    await db.commit()

    await enqueue_ocr_job(str(document_id))
    return {"message": "Document queued for reprocessing"}


# --- OCR Text Correction ---


@router.patch("/{document_id}/ocr/{page_number}", response_model=OCRPageResponse)
async def correct_ocr_text(
    document_id: uuid.UUID,
    page_number: int,
    body: OCRCorrectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Manually correct OCR text for a specific page."""
    result = await db.execute(
        select(OCRPage).where(
            OCRPage.document_id == document_id,
            OCRPage.page_number == page_number,
        )
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="OCR page not found")

    page.full_text = body.full_text
    await db.commit()
    await db.refresh(page)

    # Update combined ocr_text on the document
    pages_result = await db.execute(
        select(OCRPage)
        .where(OCRPage.document_id == document_id)
        .order_by(OCRPage.page_number)
    )
    all_pages = pages_result.scalars().all()
    combined_text = "\n\n".join(p.full_text or "" for p in all_pages)

    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_result.scalar_one_or_none()
    if doc:
        doc.ocr_text = combined_text
        await db.commit()

    resp = OCRPageResponse.model_validate(page)
    if page.page_image_s3_key:
        resp.page_image_url = await storage_service.get_presigned_url(
            page.page_image_s3_key
        )
    return resp


# --- Sharing ---


@router.post("/{document_id}/share", response_model=ShareResponse)
async def create_share_link(
    document_id: uuid.UUID,
    body: ShareRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate a share link for a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.share_token:
        document.share_token = secrets.token_urlsafe(32)

    if body:
        document.is_public = body.is_public

    await db.commit()
    await db.refresh(document)

    share_url = f"/shared/{document.share_token}"

    return ShareResponse(
        share_token=document.share_token,
        share_url=share_url,
        is_public=document.is_public,
    )


@router.delete("/{document_id}/share")
async def revoke_share_link(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Revoke the share link for a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.share_token = None
    document.is_public = False
    await db.commit()

    return {"message": "Share link revoked"}


# --- Public shared view (no auth) ---

shared_router = APIRouter(prefix="/shared", tags=["shared"])


@shared_router.get("/{share_token}", response_model=DocumentResponse)
async def get_shared_document(share_token: str, db: AsyncSession = Depends(get_db)):
    """Get a publicly shared document by its share token."""
    result = await db.execute(
        select(Document).where(
            Document.share_token == share_token,
            Document.is_public.is_(True),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Shared document not found")

    url = await storage_service.get_presigned_url(document.s3_key)
    resp = DocumentResponse.model_validate(document)
    resp.download_url = url
    return resp
