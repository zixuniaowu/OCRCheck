from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.routes import comments, documents, health, search
from app.config import settings
from app.db.database import init_db
from app.services.storage import storage_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await storage_service.ensure_bucket()
    yield
    # Shutdown


app = FastAPI(
    title="OCRCheck API",
    description="書類スキャン・OCR・AI管理システム",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:9000",
        "http://localhost:3000",
        "http://localhost:7860",
        "https://*.hf.space",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(documents.shared_router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/files/{file_path:path}")
async def serve_file(file_path: str):
    """Serve uploaded files from local filesystem (used when storage_backend=filesystem)."""
    if settings.storage_backend != "filesystem":
        raise HTTPException(status_code=404, detail="File serving only available in filesystem mode")
    full_path = Path(settings.upload_dir) / file_path
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    # Prevent path traversal
    try:
        full_path.resolve().relative_to(Path(settings.upload_dir).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    return FileResponse(full_path)
