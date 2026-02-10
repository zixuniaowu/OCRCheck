"""Full-text search service.

Supports two backends:
- OpenSearch with kuromoji analyzer (default, for docker-compose)
- PostgreSQL with pg_trgm (for HF Spaces single-container deploy)
"""

import logging
import re
from typing import Any

from app.config import settings

if settings.search_backend != "postgresql":
    from opensearchpy import OpenSearch

logger = logging.getLogger(__name__)

INDEX_NAME = settings.opensearch_index

# Index mapping with kuromoji analyzer for Japanese text
INDEX_SETTINGS = {
    "settings": {
        "analysis": {
            "analyzer": {
                "ja_analyzer": {
                    "type": "custom",
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": [
                        "kuromoji_baseform",
                        "kuromoji_part_of_speech",
                        "ja_stop",
                        "lowercase",
                    ],
                },
                "ja_search_analyzer": {
                    "type": "custom",
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": [
                        "kuromoji_baseform",
                        "kuromoji_part_of_speech",
                        "ja_stop",
                        "lowercase",
                        "kuromoji_stemmer",
                    ],
                },
            },
            "filter": {
                "ja_stop": {
                    "type": "stop",
                    "stopwords": "_japanese_",
                },
            },
        },
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
    "mappings": {
        "properties": {
            "document_id": {"type": "keyword"},
            "original_filename": {
                "type": "text",
                "analyzer": "ja_analyzer",
                "search_analyzer": "ja_search_analyzer",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "content_type": {"type": "keyword"},
            "ocr_text": {
                "type": "text",
                "analyzer": "ja_analyzer",
                "search_analyzer": "ja_search_analyzer",
            },
            "summary": {
                "type": "text",
                "analyzer": "ja_analyzer",
                "search_analyzer": "ja_search_analyzer",
            },
            "category": {"type": "keyword"},
            "tags": {"type": "keyword"},
            "entities_people": {"type": "keyword"},
            "entities_organizations": {"type": "keyword"},
            "entities_dates": {"type": "keyword"},
            "entities_amounts": {"type": "keyword"},
            "entities_references": {"type": "keyword"},
            "key_points": {
                "type": "text",
                "analyzer": "ja_analyzer",
                "search_analyzer": "ja_search_analyzer",
            },
            "document_date": {"type": "date", "format": "yyyy-MM-dd||epoch_millis", "ignore_malformed": True},
            "page_count": {"type": "integer"},
            "file_size": {"type": "integer"},
            "created_at": {"type": "date"},
        }
    },
}


def get_client() -> OpenSearch:
    return OpenSearch(
        hosts=[settings.opensearch_url],
        use_ssl=False,
        verify_certs=False,
    )


def ensure_index():
    """Create the search index if it doesn't exist."""
    client = get_client()
    if not client.indices.exists(index=INDEX_NAME):
        client.indices.create(index=INDEX_NAME, body=INDEX_SETTINGS)
        logger.info(f"Created OpenSearch index: {INDEX_NAME}")
    else:
        logger.info(f"OpenSearch index already exists: {INDEX_NAME}")


def index_document(
    document_id: str,
    original_filename: str,
    content_type: str,
    ocr_text: str | None,
    summary: str | None,
    category: str | None,
    tags: list[str] | None,
    entities: dict | None,
    key_points: list[str] | None,
    document_date: str | None,
    page_count: int | None,
    file_size: int,
    created_at: str,
):
    """Index or update a document in OpenSearch."""
    client = get_client()

    doc_body = {
        "document_id": document_id,
        "original_filename": original_filename,
        "content_type": content_type,
        "ocr_text": ocr_text or "",
        "summary": summary or "",
        "category": category,
        "tags": tags or [],
        "entities_people": (entities or {}).get("people", []),
        "entities_organizations": (entities or {}).get("organizations", []),
        "entities_dates": (entities or {}).get("dates", []),
        "entities_amounts": (entities or {}).get("amounts", []),
        "entities_references": (entities or {}).get("references", []),
        "key_points": key_points or [],
        "document_date": document_date,
        "page_count": page_count,
        "file_size": file_size,
        "created_at": created_at,
    }

    client.index(index=INDEX_NAME, id=document_id, body=doc_body)
    logger.info(f"Indexed document {document_id} in OpenSearch")


def delete_document(document_id: str):
    """Remove a document from the search index."""
    client = get_client()
    try:
        client.delete(index=INDEX_NAME, id=document_id)
    except Exception:
        pass  # Ignore if not found


def search_documents(
    query: str | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    """
    Full-text search with filters.
    Returns: {"hits": [...], "total": int, "facets": {...}}
    """
    client = get_client()

    must_clauses = []
    filter_clauses = []

    # Full-text query
    if query and query.strip():
        must_clauses.append({
            "multi_match": {
                "query": query,
                "fields": [
                    "ocr_text^1",
                    "summary^2",
                    "original_filename^3",
                    "key_points^1.5",
                ],
                "type": "best_fields",
                "fuzziness": "AUTO",
            }
        })

    # Category filter
    if category:
        filter_clauses.append({"term": {"category": category}})

    # Tags filter
    if tags:
        for tag in tags:
            filter_clauses.append({"term": {"tags": tag}})

    # Date range filter
    if date_from or date_to:
        date_range: dict = {}
        if date_from:
            date_range["gte"] = date_from
        if date_to:
            date_range["lte"] = date_to
        filter_clauses.append({"range": {"document_date": date_range}})

    # Build query
    if not must_clauses and not filter_clauses:
        search_query: dict = {"match_all": {}}
    else:
        bool_query: dict = {}
        if must_clauses:
            bool_query["must"] = must_clauses
        if filter_clauses:
            bool_query["filter"] = filter_clauses
        search_query = {"bool": bool_query}

    search_body = {
        "query": search_query,
        "from": skip,
        "size": limit,
        "sort": [
            {"_score": {"order": "desc"}},
            {"created_at": {"order": "desc"}},
        ],
        "highlight": {
            "fields": {
                "ocr_text": {"fragment_size": 150, "number_of_fragments": 3},
                "summary": {"fragment_size": 200, "number_of_fragments": 1},
                "key_points": {"fragment_size": 150, "number_of_fragments": 2},
            },
            "pre_tags": ["<mark>"],
            "post_tags": ["</mark>"],
        },
        "aggs": {
            "categories": {"terms": {"field": "category", "size": 20}},
            "tags": {"terms": {"field": "tags", "size": 50}},
        },
    }

    result = client.search(index=INDEX_NAME, body=search_body)

    hits = []
    for hit in result["hits"]["hits"]:
        source = hit["_source"]
        source["_score"] = hit.get("_score")
        source["_highlights"] = hit.get("highlight", {})
        hits.append(source)

    total = result["hits"]["total"]["value"]

    facets = {}
    if "aggregations" in result:
        facets["categories"] = [
            {"key": b["key"], "count": b["doc_count"]}
            for b in result["aggregations"]["categories"]["buckets"]
        ]
        facets["tags"] = [
            {"key": b["key"], "count": b["doc_count"]}
            for b in result["aggregations"]["tags"]["buckets"]
        ]

    return {"hits": hits, "total": total, "facets": facets}


# ---------------------------------------------------------------------------
# PostgreSQL search backend (pg_trgm + LIKE for Japanese n-gram)
# ---------------------------------------------------------------------------

_pg_engine = None
_pg_session_factory = None


def _get_pg_session():
    global _pg_engine, _pg_session_factory
    if _pg_engine is None:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
        _pg_engine = create_engine(sync_url)
        _pg_session_factory = sessionmaker(bind=_pg_engine)
    return _pg_session_factory()


def pg_ensure_index():
    """Create pg_trgm extension and GIN index on search_text."""
    from sqlalchemy import text

    db = _get_pg_session()
    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_documents_search_text_trgm "
            "ON documents USING gin (search_text gin_trgm_ops)"
        ))
        db.commit()
        logger.info("PostgreSQL pg_trgm index ensured")
    finally:
        db.close()


def pg_index_document(
    document_id: str,
    original_filename: str,
    content_type: str,
    ocr_text: str | None,
    summary: str | None,
    category: str | None,
    tags: list[str] | None,
    entities: dict | None,
    key_points: list[str] | None,
    document_date: str | None,
    page_count: int | None,
    file_size: int,
    created_at: str,
):
    """Update search_text column for a document."""
    from sqlalchemy import text

    parts = [
        original_filename or "",
        ocr_text or "",
        summary or "",
    ]
    if key_points:
        parts.extend(key_points)
    if tags:
        parts.extend(tags)
    search_text = "\n".join(p for p in parts if p)

    db = _get_pg_session()
    try:
        db.execute(
            text("UPDATE documents SET search_text = :st WHERE id = :did"),
            {"st": search_text, "did": document_id},
        )
        db.commit()
        logger.info(f"Indexed document {document_id} in PostgreSQL search_text")
    finally:
        db.close()


def pg_delete_document(document_id: str):
    """Clear search_text for a document."""
    from sqlalchemy import text

    db = _get_pg_session()
    try:
        db.execute(
            text("UPDATE documents SET search_text = NULL WHERE id = :did"),
            {"did": document_id},
        )
        db.commit()
    finally:
        db.close()


def _highlight_text(text_content: str, query: str, context_chars: int = 75) -> list[str]:
    """Generate highlighted snippets around query matches."""
    if not text_content or not query:
        return []
    fragments = []
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    for match in pattern.finditer(text_content):
        start = max(0, match.start() - context_chars)
        end = min(len(text_content), match.end() + context_chars)
        snippet = text_content[start:end]
        snippet = pattern.sub(lambda m: f"<mark>{m.group()}</mark>", snippet)
        if start > 0:
            snippet = "..." + snippet
        if end < len(text_content):
            snippet = snippet + "..."
        fragments.append(snippet)
        if len(fragments) >= 3:
            break
    return fragments


def pg_search_documents(
    query: str | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    """PostgreSQL-based search returning same structure as OpenSearch version."""
    from sqlalchemy import text

    db = _get_pg_session()
    try:
        conditions = []
        params: dict[str, Any] = {}

        if query and query.strip():
            conditions.append("search_text ILIKE :q")
            params["q"] = f"%{query.strip()}%"

        if category:
            conditions.append("category = :cat")
            params["cat"] = category

        if tags:
            for i, tag in enumerate(tags):
                conditions.append(f"tags::jsonb ? :tag{i}")
                params[f"tag{i}"] = tag

        if date_from:
            conditions.append("document_date >= :dfrom")
            params["dfrom"] = date_from

        if date_to:
            conditions.append("document_date <= :dto")
            params["dto"] = date_to

        where = " AND ".join(conditions) if conditions else "TRUE"

        # Count
        count_sql = f"SELECT count(*) FROM documents WHERE {where}"
        total = db.execute(text(count_sql), params).scalar() or 0

        # Fetch results
        fetch_sql = (
            f"SELECT id, original_filename, content_type, ocr_text, summary, "
            f"category, tags, entities, key_points, document_date, page_count, "
            f"file_size, created_at "
            f"FROM documents WHERE {where} "
            f"ORDER BY created_at DESC "
            f"LIMIT :lim OFFSET :off"
        )
        params["lim"] = limit
        params["off"] = skip
        rows = db.execute(text(fetch_sql), params).fetchall()

        hits = []
        for row in rows:
            entities_val = row[7] or {}
            highlights = {}
            if query and query.strip():
                ocr_hl = _highlight_text(row[3] or "", query.strip())
                if ocr_hl:
                    highlights["ocr_text"] = ocr_hl
                summary_hl = _highlight_text(row[4] or "", query.strip())
                if summary_hl:
                    highlights["summary"] = summary_hl

            hits.append({
                "document_id": str(row[0]),
                "original_filename": row[1],
                "content_type": row[2],
                "ocr_text": (row[3] or "")[:500],
                "summary": row[4] or "",
                "category": row[5],
                "tags": row[6] or [],
                "entities_people": entities_val.get("people", []),
                "entities_organizations": entities_val.get("organizations", []),
                "page_count": row[10],
                "file_size": row[11],
                "document_date": row[9],
                "created_at": row[12].isoformat() if row[12] else None,
                "_score": None,
                "_highlights": highlights,
            })

        # Facets
        cat_sql = (
            f"SELECT category, count(*) FROM documents "
            f"WHERE category IS NOT NULL AND ({where}) "
            f"GROUP BY category ORDER BY count(*) DESC LIMIT 20"
        )
        cat_rows = db.execute(text(cat_sql), params).fetchall()
        categories_facet = [{"key": r[0], "count": r[1]} for r in cat_rows]

        tag_sql = (
            f"SELECT tag, count(*) FROM documents, "
            f"jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS tag "
            f"WHERE ({where}) "
            f"GROUP BY tag ORDER BY count(*) DESC LIMIT 50"
        )
        tag_rows = db.execute(text(tag_sql), params).fetchall()
        tags_facet = [{"key": r[0], "count": r[1]} for r in tag_rows]

        return {
            "hits": hits,
            "total": total,
            "facets": {"categories": categories_facet, "tags": tags_facet},
        }
    finally:
        db.close()
