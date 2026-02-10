from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import comments, documents, health, search
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
    allow_origins=["http://localhost:9000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(documents.shared_router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(search.router, prefix="/api")
