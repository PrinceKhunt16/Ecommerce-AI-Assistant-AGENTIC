"""LangGraph agent state."""

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """State threaded through the planner → executor → synthesizer graph.

    ``messages`` accumulates the running transcript (human / AI / tool messages); the
    ``add_messages`` reducer handles appends and id-based updates. ``steps`` guards the
    planner↔executor loop against runaway iterations. Both keys are always populated (set
    in ``SupportAgent._initial_state``), so they're required — node functions still return
    partial ``dict`` updates that LangGraph merges.
    """

    messages: Annotated[list[AnyMessage], add_messages]
    steps: int
