from functools import lru_cache

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import ToolNode

from app.agent.llm import get_chat_model, to_text
from app.agent.prompts import PLANNER_PROMPT, SYNTHESIZER_PROMPT, SYSTEM_PROMPT
from app.agent.state import AgentState
from app.agent.tools import get_tools
from app.config import settings


@lru_cache
def _planner_model():
    # temperature=0 for deterministic tool selection.
    return get_chat_model(temperature=0).bind_tools(get_tools())


def _planner_node():
    async def planner(state: AgentState) -> dict:
        system = SystemMessage(content=f"{SYSTEM_PROMPT}\n\n{PLANNER_PROMPT}")
        messages = [system, *state["messages"]]
        # Any hard LLM failure (e.g. a Gemini 429) propagates to ChatService, which turns
        # it into a clean 503 rather than letting the synthesizer invent an answer.
        response = await _planner_model().ainvoke(messages)
        return {"messages": [response], "steps": state.get("steps", 0) + 1}

    return planner


def _synthesizer_node():
    """Compose the final answer from the conversation + this turn's tool results.

    We rebuild a clean prompt rather than replay the planner/tool scaffolding: the
    planner's messages are dropped (it must not pre-write the reply) and tool outputs are
    handed over as a single context note. This keeps the synthesizer the sole author and
    avoids tool-message ordering constraints (it has no tools bound).
    """

    async def synthesizer(state: AgentState) -> dict:
        messages = list(state["messages"])
        # Drop the planner's trailing "done" message so its draft can't leak in.
        if messages and isinstance(messages[-1], AIMessage) and not messages[-1].tool_calls:
            messages.pop()
        convo = [
            m
            for m in messages
            if isinstance(m, HumanMessage)
            or (isinstance(m, AIMessage) and not m.tool_calls and m.content)
        ]
        tool_notes = [
            str(m.content) for m in messages if isinstance(m, ToolMessage) and m.content
        ]

        prompt: list = [SystemMessage(content=f"{SYSTEM_PROMPT}\n\n{SYNTHESIZER_PROMPT}")]
        prompt.extend(convo)
        if tool_notes:
            prompt.append(
                SystemMessage(
                    content="Information gathered from tools (use it to answer):\n\n"
                    + "\n\n".join(tool_notes)
                )
            )
        response = await get_chat_model().ainvoke(prompt)
        return {"messages": [AIMessage(content=to_text(response.content))]}

    return synthesizer


def _route_after_planner(state: AgentState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None) and state.get("steps", 0) < (
        settings.max_agent_iterations
    ):
        return "executor"
    return "synthesizer"


@lru_cache
def build_agent_graph() -> CompiledStateGraph:
    """Build and compile the support-agent graph (cached singleton)."""
    graph = StateGraph(AgentState)

    graph.add_node("planner", _planner_node())
    graph.add_node("executor", ToolNode(get_tools()))
    graph.add_node("synthesizer", _synthesizer_node())

    graph.add_edge(START, "planner")
    graph.add_conditional_edges(
        "planner",
        _route_after_planner,
        {"executor": "executor", "synthesizer": "synthesizer"},
    )
    graph.add_edge("executor", "planner")
    graph.add_edge("synthesizer", END)

    return graph.compile()
