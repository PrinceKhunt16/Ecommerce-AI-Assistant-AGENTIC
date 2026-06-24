"""Conversation history endpoints (the signed-in customer's own conversations)."""

import uuid

from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.conversation import ConversationRead, ConversationSummary
from app.security import CurrentUser
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    user: CurrentUser, session: SessionDep
) -> list[ConversationSummary]:
    convs = await ConversationService(session).list_for_user(user.id)
    return [ConversationSummary.model_validate(c) for c in convs]


@router.get("/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    conversation_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> ConversationRead:
    conv = await ConversationService(session).get_for_user(conversation_id, user.id)
    return ConversationRead.model_validate(conv)
