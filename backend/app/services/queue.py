import json

import redis.asyncio as aioredis

from app.config import settings

QUEUE_NAME = "ocrcheck:jobs"


async def get_redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def enqueue_ocr_job(document_id: str):
    r = await get_redis()
    job = json.dumps({"type": "ocr", "document_id": document_id})
    await r.lpush(QUEUE_NAME, job)
    await r.aclose()


def get_sync_redis():
    import redis
    return redis.from_url(settings.redis_url, decode_responses=True)


def dequeue_job(timeout: int = 5) -> dict | None:
    r = get_sync_redis()
    result = r.brpop(QUEUE_NAME, timeout=timeout)
    r.close()
    if result is None:
        return None
    _, job_data = result
    return json.loads(job_data)
