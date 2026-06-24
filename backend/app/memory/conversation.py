"""Short-term conversation memory backed by Redis.

Stores the recent turn window per conversation as a JSON list, with a TTL so idle
conversations expire. Durable history is persisted separately in PostgreSQL via
``app.models.conversation``.
"""

import json
from dataclasses import asdict, dataclass

import redis.asyncio as redis

from app.config import settings


@dataclass
class Turn:
    role: str  # user | assistant
    content: str


class ConversationMemory:
    def __init__(self, client: redis.Redis | None = None, max_turns: int = 20) -> None:
        self._redis = client or redis.from_url(
            str(settings.redis_url), decode_responses=True
        )
        self.max_turns = max_turns
        self.ttl = settings.conversation_ttl_seconds

    @staticmethod
    def _key(conversation_id: str) -> str:
        return f"conv:{conversation_id}:turns"

    async def get_history(self, conversation_id: str) -> list[Turn]:
        raw = await self._redis.lrange(self._key(conversation_id), 0, -1)
        return [Turn(**json.loads(item)) for item in raw]

    async def append(self, conversation_id: str, turn: Turn) -> None:
        key = self._key(conversation_id)
        await self._redis.rpush(key, json.dumps(asdict(turn)))
        await self._redis.ltrim(key, -self.max_turns, -1)
        await self._redis.expire(key, self.ttl)

    async def clear(self, conversation_id: str) -> None:
        await self._redis.delete(self._key(conversation_id))
