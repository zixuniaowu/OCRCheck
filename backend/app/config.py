from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ocrcheck:ocrcheck_dev@db:5432/ocrcheck"

    # S3 / MinIO
    s3_endpoint_url: str = "http://minio:9000"
    s3_public_url: str = "http://localhost:9004"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "ocrcheck-documents"
    s3_region: str = "ap-northeast-1"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # OpenSearch
    opensearch_url: str = "http://opensearch:9200"
    opensearch_index: str = "ocrcheck-documents"

    # AI (Claude API)
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-4-5-20250929"
    ai_max_tokens: int = 4096
    ai_enabled: bool = True  # set False to skip AI analysis

    # App
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    max_upload_size_mb: int = 100

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
