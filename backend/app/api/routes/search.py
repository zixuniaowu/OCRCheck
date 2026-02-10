from fastapi import APIRouter, Query

from app.services.search import search_documents

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def search(
    q: str | None = Query(None, description="Full-text search query"),
    category: str | None = Query(None, description="Filter by category"),
    tags: list[str] | None = Query(None, description="Filter by tags"),
    date_from: str | None = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter to date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Search documents with full-text query and filters.
    Returns results with highlights and facets.
    """
    result = search_documents(
        query=q,
        category=category,
        tags=tags,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return result
