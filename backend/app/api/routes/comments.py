import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import CommentCreate, CommentResponse, CommentUpdate
from app.db.database import get_db
from app.models.comment import Comment
from app.models.document import Document

router = APIRouter(prefix="/documents/{document_id}/comments", tags=["comments"])


async def _get_document(document_id: uuid.UUID, db: AsyncSession) -> Document:
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/", response_model=list[CommentResponse])
async def list_comments(
    document_id: uuid.UUID,
    page_number: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    await _get_document(document_id, db)

    query = (
        select(Comment)
        .where(Comment.document_id == document_id)
        .order_by(Comment.created_at.asc())
    )
    if page_number is not None:
        query = query.where(Comment.page_number == page_number)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=CommentResponse, status_code=201)
async def create_comment(
    document_id: uuid.UUID,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_document(document_id, db)

    comment = Comment(
        document_id=document_id,
        page_number=body.page_number,
        content=body.content,
        author=body.author,
        region=body.region,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    document_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: CommentUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id, Comment.document_id == document_id
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.content = body.content
    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    document_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id, Comment.document_id == document_id
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    await db.delete(comment)
    await db.commit()
