"""Gemini chat-model factory (the only LLM provider).

Returns a tool-calling + streaming chat model. Built lazily and cached so the graph
compiles without credentials; a missing key only errors on first real use.
"""

from functools import lru_cache
from typing import Any

from langchain_core.language_models import BaseChatModel

from app.config import settings


def to_text(content: Any) -> str:
    """Flatten a chat message/chunk's ``content`` to plain text.

    Gemini returns content as a list of typed blocks (e.g.
    ``[{"type": "text", "text": "..."}]``) rather than the plain string Groq used to
    return. The streaming events, the final reply, and persistence all expect a string,
    so normalize here in one place.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
        return "".join(parts)
    return str(content)


@lru_cache
def get_chat_model(temperature: float = 0.2) -> BaseChatModel:
    """Return a cached ChatGoogleGenerativeAI (Gemini).

    Used by both the planner (bound to the tools) and the synthesizer (whose tokens
    stream as the answer via ``astream_events``). Gemini handles streaming tool calls
    reliably, so — unlike the previous Groq/llama setup — no non-streaming workaround is
    needed.
    """
    from langchain_google_genai import ChatGoogleGenerativeAI

    cfg = settings.gemini
    if not cfg.api_key:
        raise RuntimeError(
            "GEMINI__API_KEY is not set. Get a free key at https://aistudio.google.com/apikey"
        )
    return ChatGoogleGenerativeAI(
        model=cfg.model,
        google_api_key=cfg.api_key,
        temperature=temperature,
    )
