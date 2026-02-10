import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.document import DocumentStatus


class EntitiesResponse(BaseModel):
    people: list[str] = []
    organizations: list[str] = []
    dates: list[str] = []
    amounts: list[str] = []
    addresses: list[str] = []
    references: list[str] = []


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    s3_key: str
    status: DocumentStatus
    page_count: int | None
    category: str | None
    category_confidence: float | None = None
    summary: str | None
    tags: list[str] | None = None
    entities: EntitiesResponse | None = None
    document_date: str | None = None
    key_points: list[str] | None = None
    share_token: str | None = None
    is_public: bool = False
    created_at: datetime
    updated_at: datetime
    download_url: str | None = None

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class UploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: DocumentStatus
    message: str


class OCRBlockResponse(BaseModel):
    text: str
    bbox: list[float]
    confidence: float


class OCRTableResponse(BaseModel):
    bbox: list[float]
    html: str


class OCRPageResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    page_number: int
    width: int
    height: int
    full_text: str | None
    blocks: list[OCRBlockResponse] | None = None
    tables: list[OCRTableResponse] | None = None
    confidence: float | None
    page_image_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- OCR Correction ---


class OCRCorrectionRequest(BaseModel):
    full_text: str


# --- Comments ---


class CommentCreate(BaseModel):
    page_number: int | None = None
    content: str
    author: str = "anonymous"
    region: dict | None = None


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    page_number: int | None
    content: str
    author: str
    region: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Sharing ---


class ShareRequest(BaseModel):
    is_public: bool = True


class ShareResponse(BaseModel):
    share_token: str
    share_url: str
    is_public: bool
