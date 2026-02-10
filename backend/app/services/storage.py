import os
import uuid
from datetime import datetime
from pathlib import Path

import aioboto3
from botocore.config import Config

from app.config import settings


class FilesystemStorageService:
    """Storage backend using the local filesystem instead of S3/MinIO."""

    def __init__(self):
        self.base_dir = Path(settings.upload_dir)

    async def ensure_bucket(self):
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def generate_s3_key(self, original_filename: str) -> str:
        now = datetime.utcnow()
        unique_id = uuid.uuid4().hex[:12]
        ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
        return f"{now.year}/{now.month:02d}/{unique_id}.{ext}"

    async def upload_file(self, s3_key: str, file_data: bytes, content_type: str) -> str:
        file_path = self.base_dir / s3_key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(file_data)
        return s3_key

    async def get_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        return f"/files/{s3_key}"

    async def delete_file(self, s3_key: str):
        file_path = self.base_dir / s3_key
        if file_path.exists():
            file_path.unlink()

    # Sync helpers for the OCR worker
    def download_file_sync(self, key: str) -> bytes:
        return (self.base_dir / key).read_bytes()

    def upload_file_sync(self, key: str, data: bytes, content_type: str):
        file_path = self.base_dir / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)


class StorageService:
    def __init__(self):
        self.session = aioboto3.Session()
        self.bucket_name = settings.s3_bucket_name
        self.config = Config(
            s3={"addressing_style": "path"},
            signature_version="s3v4",
            region_name=settings.s3_region,
        )

    def _get_client_kwargs(self):
        return {
            "endpoint_url": settings.s3_endpoint_url,
            "aws_access_key_id": settings.s3_access_key,
            "aws_secret_access_key": settings.s3_secret_key,
            "config": self.config,
        }

    async def ensure_bucket(self):
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            try:
                await s3.head_bucket(Bucket=self.bucket_name)
            except Exception:
                await s3.create_bucket(Bucket=self.bucket_name)

    def generate_s3_key(self, original_filename: str) -> str:
        now = datetime.utcnow()
        unique_id = uuid.uuid4().hex[:12]
        ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
        return f"{now.year}/{now.month:02d}/{unique_id}.{ext}"

    async def upload_file(self, s3_key: str, file_data: bytes, content_type: str) -> str:
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await s3.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_data,
                ContentType=content_type,
            )
        return s3_key

    def _get_public_client_kwargs(self):
        """Client kwargs using the public URL so presigned URLs are valid for browsers.

        MinIO uses us-east-1 by default. The region in the signature must match
        what MinIO expects, otherwise presigned URLs get 403 SignatureDoesNotMatch.
        """
        endpoint = settings.s3_public_url or settings.s3_endpoint_url
        public_config = Config(
            s3={"addressing_style": "path"},
            signature_version="s3v4",
            region_name="us-east-1",
        )
        return {
            "endpoint_url": endpoint,
            "aws_access_key_id": settings.s3_access_key,
            "aws_secret_access_key": settings.s3_secret_key,
            "config": public_config,
        }

    async def get_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        async with self.session.client("s3", **self._get_public_client_kwargs()) as s3:
            url = await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=expires_in,
            )
        return url

    async def delete_file(self, s3_key: str):
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await s3.delete_object(Bucket=self.bucket_name, Key=s3_key)


if settings.storage_backend == "filesystem":
    storage_service = FilesystemStorageService()
else:
    storage_service = StorageService()
