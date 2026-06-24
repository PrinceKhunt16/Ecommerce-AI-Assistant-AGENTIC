"""Chat orchestration: short-term memory + agent + durable persistence + streaming.

Owns its own DB session for the whole turn so persistence keeps working after the
streaming response has started (it does not rely on the request-scoped session, which
would close before the stream finishes).
"""

import uuid
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.runnables import RunnableConfig

from app.agent.support_agent import get_support_agent
from app.db import sessionmaker
from app.errors import friendly_llm_error
from app.logging import get_logger
from app.memory.conversation import ConversationMemory, Turn
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.security import current_user_id
from app.services.conversation_service import ConversationService

logger = get_logger(__name__)


class ChatService:
    def __init__(self, user: User, memory: ConversationMemory | None = None) -> None:
        self.user = user
        self.agent = get_support_agent()
        self.memory = memory or ConversationMemory()

    async def _history(self, conversation_id: uuid.UUID) -> list[tuple[str, str]]:
        turns = await self.memory.get_history(str(conversation_id))
        return [(t.role, t.content) for t in turns]

    async def _remember(
        self, conversation_id: uuid.UUID, user_msg: str, assistant_msg: str
    ) -> None:
        key = str(conversation_id)
        await self.memory.append(key, Turn(role="user", content=user_msg))
        await self.memory.append(key, Turn(role="assistant", content=assistant_msg))

    async def stream(self, req: ChatRequest) -> AsyncIterator[dict[str, Any]]:
        """Yield every event of a turn: thinking · tool_call · tool_result · token, then
        ``done`` — or an ``error`` event if the agent/LLM fails."""
        async with sessionmaker() as session:
            convs = ConversationService(session)
            conversation = await convs.get_or_create(
                self.user.id, req.conversation_id, first_message=req.message
            )
            conv_id = conversation.id
            history = await self._history(conv_id)

            # Tag the LangSmith trace so runs can be filtered by user/conversation.
            # (No-op when tracing is disabled — it's just RunnableConfig metadata.)
            trace_config: RunnableConfig = {
                "run_name": "support-chat-turn",
                "tags": ["chat", "websocket"],
                "metadata": {
                    "user_id": str(self.user.id),
                    "conversation_id": str(conv_id),
                },
            }

            collected: list[str] = []
            errored = False
            token = current_user_id.set(str(self.user.id))
            try:
                async for event in self.agent.stream_events(
                    req.message, history, config=trace_config
                ):
                    if event["type"] == "token":
                        collected.append(event["data"])
                    yield event
            except Exception as exc:  # noqa: BLE001
                # The agent/LLM failed mid-stream (e.g. a Gemini 429). Tell the client
                # instead of silently dropping the stream; the transport stays open.
                errored = True
                logger.exception("chat.stream_failed", error=str(exc))
                yield {"type": "error", "data": friendly_llm_error(exc)}
            finally:
                current_user_id.reset(token)

            if errored:
                return  # error event already sent; skip persistence and the done event

            reply = "".join(collected)
            await convs.record_turn(
                conversation, user_message=req.message, assistant_message=reply
            )
            await session.commit()

        await self._remember(conv_id, req.message, reply)
        yield {"type": "done", "conversation_id": str(conv_id)}
