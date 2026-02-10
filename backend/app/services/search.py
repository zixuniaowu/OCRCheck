"""OpenSearch service for full-text search with Japanese (kuromoji) support."""

import logging
from typing import Any

from opensearchpy import OpenSearch

from app.config import settings

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
