"""Durable conversation persistence (Postgres)."""

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.models.conversation import Conversation
from app.repositories.conversation_repository import ConversationRepository


class ConversationService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ConversationRepository(session)

    async def list_for_user(self, user_id: uuid.UUID) -> Sequence[Conversation]:
        return await self.repo.list_for_user(user_id)

    async def get_for_user(
        self, conversation_id: uuid.UUID, user_id: uuid.UUID
    ) -> Conversation:
        conversation = await self.repo.get_for_user(conversation_id, user_id)
        if conversation is None:
            raise NotFoundError("Conversation not found.")
        return conversation

    async def get_or_create(
        self,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID | None,
        *,
        first_message: str,
    ) -> Conversation:
        if conversation_id is not None:
            existing = await self.repo.get_for_user(conversation_id, user_id)
            if existing is not None:
                return existing
        title = first_message.strip()[:60] or "New conversation"
        return await self.repo.add(Conversation(user_id=user_id, title=title))

    async def record_turn(
        self,
        conversation: Conversation,
        *,
        user_message: str,
        assistant_message: str,
    ) -> None:
        await self.repo.add_message(conversation, "user", user_message)
        await self.repo.add_message(conversation, "assistant", assistant_message)
