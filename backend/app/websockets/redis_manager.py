import redis.asyncio as redis
from typing import Optional
from app.core.config import settings

class RedisPubSubManager:
    """
    Manages Redis async connections for Pub/Sub messaging across WebSocket nodes.
    """
    def __init__(self, url: str):
        self.redis_url = url
        self.redis_pool: Optional[redis.Redis] = None

    async def connect(self):
        self.redis_pool = redis.from_url(self.redis_url, decode_responses=True)

    async def disconnect(self):
        if self.redis_pool:
            await self.redis_pool.aclose()

    async def publish(self, channel: str, message: str):
        if self.redis_pool is not None:
            await self.redis_pool.publish(channel, message)

    async def subscribe(self, channel: str) -> redis.client.PubSub:
        if self.redis_pool is not None:
            pubsub = self.redis_pool.pubsub()
            await pubsub.subscribe(channel)
            return pubsub
        raise RuntimeError("Redis pool is not initialized")

pubsub_manager = RedisPubSubManager(settings.REDIS_URL)
