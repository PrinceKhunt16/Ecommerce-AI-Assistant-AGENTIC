"""WebSocket chat — the single chat transport.

Connect to ``/ws/chat?token=<jwt>``, then send one JSON object per turn:
``{"message": "...", "conversation_id": "<uuid or null>"}``.

The server streams back the whole life of the turn as JSON events, each tagged ``type``:

  - ``thinking``    {"type": "thinking", "data": "<text>"}             planner reasoning
  - ``tool_call``   {"type": "tool_call", "name": ..., "args": {...}}  a tool is invoked
  - ``tool_result`` {"type": "tool_result", "name": ..., "data": ...}  its (truncated) output
  - ``token``       {"type": "token", "data": "<text>"}                the reply, streamed
  - ``error``       {"type": "error", "data": "<message>"}             the turn failed
  - ``done``        {"type": "done", "conversation_id": "<uuid>"}      turn finished

The socket stays open across turns; an ``error`` ends only the current turn (no ``done``
follows it). Save ``conversation_id`` from ``done`` and send it back to continue the thread.
"""

import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.db import sessionmaker
from app.logging import get_logger
from app.repositories.user_repository import UserRepository
from app.schemas.chat import ChatRequest
from app.security import decode_access_token
from app.services.chat_service import ChatService

router = APIRouter()
logger = get_logger(__name__)


async def _authenticate(websocket: WebSocket):
    token = websocket.query_params.get("token", "")
    user_id = decode_access_token(token)
    if not user_id:
        return None
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None
    async with sessionmaker() as session:
        return await UserRepository(session).get(uid)


@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket) -> None:
    await websocket.accept()
    user = await _authenticate(websocket)
    if user is None:
        await websocket.close(code=1008)  # policy violation
        return

    service = ChatService(user=user)
    while True:
        try:
            payload = await websocket.receive_json()
        except WebSocketDisconnect:
            logger.info("ws.disconnect")
            return
        except Exception:  # noqa: BLE001  (a non-JSON / malformed frame)
            await websocket.send_json(
                {"type": "error", "data": 'Send a JSON object like {"message": "..."}.'}
            )
            continue

        if not isinstance(payload, dict):
            await websocket.send_json(
                {"type": "error", "data": 'Send a JSON object like {"message": "..."}.'}
            )
            continue
        try:
            req = ChatRequest(
                message=payload.get("message", ""),
                conversation_id=payload.get("conversation_id"),
            )
        except ValidationError:
            await websocket.send_json(
                {"type": "error", "data": "A non-empty 'message' is required."}
            )
            continue

        # A single failed turn must not drop the socket. ChatService already emits an
        # `error` event for agent/LLM failures; this guards setup errors (DB, etc.).
        try:
            async for event in service.stream(req):
                await websocket.send_json(event)
        except WebSocketDisconnect:
            logger.info("ws.disconnect")
            return
        except Exception as exc:  # noqa: BLE001
            logger.exception("ws.turn_failed", error=str(exc))
            await websocket.send_json(
                {"type": "error", "data": "Sorry, something went wrong. Please retry."}
            )
