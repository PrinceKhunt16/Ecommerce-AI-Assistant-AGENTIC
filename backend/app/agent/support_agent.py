"""Facade over the compiled LangGraph graph.

Exposes ``invoke`` (full reply) and ``stream_events`` (Claude-Code-style event stream:
thinking → tool_call → tool_result → token). The HTTP layer never touches LangGraph
directly.
"""

from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from app.agent.graph import build_agent_graph
from app.agent.llm import to_text
from app.agent.state import AgentState

_MAX_RESULT_CHARS = 600


def _build_messages(message: str, history: list[tuple[str, str]]) -> list[AnyMessage]:
    messages: list[AnyMessage] = []
    for role, content in history:
        messages.append(
            AIMessage(content=content)
            if role == "assistant"
            else HumanMessage(content=content)
        )
    messages.append(HumanMessage(content=message))
    return messages


class SupportAgent:
    def __init__(self) -> None:
        self._graph = build_agent_graph()

    def _initial_state(
        self, message: str, history: list[tuple[str, str]]
    ) -> AgentState:
        return {"messages": _build_messages(message, history), "steps": 0}

    async def invoke(
        self,
        message: str,
        history: list[tuple[str, str]] | None = None,
        *,
        config: RunnableConfig | None = None,
    ) -> dict[str, Any]:
        """Run to completion; return the final reply and the tools that ran.

        ``config`` carries the LangChain ``RunnableConfig`` (run name / tags / metadata)
        that surfaces on the LangSmith trace; it is harmless when tracing is off.
        """
        result = await self._graph.ainvoke(
            self._initial_state(message, history or []), config=config
        )
        messages = result["messages"]
        reply = next(
            (m for m in reversed(messages) if isinstance(m, AIMessage)
             and not getattr(m, "tool_calls", None)),
            None,
        )
        tools_used = [m.name for m in messages if isinstance(m, ToolMessage) and m.name]
        return {"reply": to_text(reply.content) if reply else "", "tools_used": tools_used}

    async def stream_events(
        self,
        message: str,
        history: list[tuple[str, str]] | None = None,
        *,
        config: RunnableConfig | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield typed events as the graph runs (the answer text arrives as ``token``).

        ``config`` carries the LangChain ``RunnableConfig`` (run name / tags / metadata)
        that surfaces on the LangSmith trace; it is harmless when tracing is off.
        """
        state = self._initial_state(message, history or [])
        async for event in self._graph.astream_events(state, version="v2", config=config):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                node = event.get("metadata", {}).get("langgraph_node")
                chunk = event["data"].get("chunk")
                text = to_text(chunk.content) if chunk is not None else ""
                if not text:
                    continue
                if node == "planner":
                    yield {"type": "thinking", "data": text}
                elif node == "synthesizer":
                    yield {"type": "token", "data": text}
            elif kind == "on_tool_start":
                yield {
                    "type": "tool_call",
                    "name": event["name"],
                    "args": event["data"].get("input"),
                }
            elif kind == "on_tool_end":
                output = event["data"].get("output")
                text = getattr(output, "content", str(output))
                yield {
                    "type": "tool_result",
                    "name": event["name"],
                    "data": str(text)[:_MAX_RESULT_CHARS],
                }


@lru_cache
def get_support_agent() -> SupportAgent:
    return SupportAgent()
