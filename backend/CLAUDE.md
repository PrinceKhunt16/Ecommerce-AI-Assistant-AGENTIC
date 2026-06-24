# Ecommerce Support Chatbot — Backend

A single support chatbot for an online store. A shopper registers/logs in (JWT), then
chats to: ask about **products**, check their own **orders** (status + tracking), and get
**shipping/returns/refund** answers (RAG). The agent streams its thinking, tool calls, and
answer to the UI. Built to learn LangGraph + tools + MCP.

Stack: FastAPI + LangGraph over **Gemini** (only LLM), **Postgres + pgvector** (only DB),
**Redis** (short-term memory), **uv** / Python 3.12. Layering: **API → Services →
Repositories → DB**. `README.md` has the run steps and is authoritative.

## Commands
- Install: `uv sync --extra dev`
- DB schema: `uv run python -m scripts.init_db`  (pgvector ext + tables; no Alembic)
- Seed data: `uv run python -m scripts.seed`  (products, demo user `demo@example.com` /
  `demo1234` with orders, knowledge base)
- Run: `uv run main.py`  → http://localhost:8000/docs
- Test / lint / types: `uv run pytest` · `uv run ruff check .` · `uv run mypy app`
- Postgres MCP server (standalone, stdio): `uv run python -m app.mcp.database_server`
- Infra: `docker compose -f docker/docker-compose.yml up -d postgres redis`

## Layout (one `main.py`, flat `app/`)
- `config.py` settings · `db.py` engine/session/Base/init · `security.py` JWT + bcrypt +
  `get_current_user` + `current_user_id` ctxvar · `logging.py` (console + `logs/logger.log`) ·
  `errors.py` · `middleware.py` (request-id + access log)
- `models/` user, product, order, conversation, knowledge_chunk · `schemas/` DTOs ·
  `repositories/` (only layer touching the ORM) · `services/` (auth, product, order,
  conversation, chat) · `memory/` Redis turns
- `rag/` local embeddings → ingest → pgvector retriever
- `agent/` llm, state, prompts, tools, graph, support_agent (facade)
- `api/` deps, router, `routes/` (auth, products, orders, conversations, health, ws — chat is `ws`)
- `mcp/database_server.py` · `data/` (products.json + knowledge/*.md) · `scripts/` (init_db, seed)

## API (prefix `/api/v1`)
Public: `GET /health` `GET /ready` · `POST /auth/register` `POST /auth/login` ·
`GET /products` `GET /products/{id}`.
Bearer (JWT): `GET /auth/me` · `GET /orders` `GET /orders/{id}` ·
`GET /conversations` `GET /conversations/{id}`.
Chat is **WebSocket-only** — `WS /ws/chat?token=<jwt>` (auth via query param). It is the
single chat route; the old `POST /chat` and `POST /chat/stream` (SSE) endpoints were removed.

## Agent (`app/agent/`)
Graph = **planner → executor → synthesizer**, looping planner↔executor while the planner
calls tools (capped by `max_agent_iterations`). Tools (thin over repositories):
`search_products`, `get_product`, `get_my_orders`, `get_order_status`,
`search_knowledge_base`. Order tools read the user from the `current_user_id` ContextVar
(set in `ChatService`) — never a model/caller-supplied id.

The facade `stream_events()` maps LangGraph `astream_events(v2)` to typed events delivered
over the chat WebSocket: `thinking` · `tool_call` · `tool_result` · `token`, then `done`
(or `error` on failure). Gemini returns message content as a list of typed blocks, so
`agent/llm.py:to_text()` flattens chunk/message content to a string before it is emitted or
persisted. `ChatService.stream()` persists each turn to Postgres, keeps recent turns in
Redis, and catches mid-stream LLM errors → emits an `error` event (`friendly_llm_error`).

## RAG
pgvector only. Embeddings are local (SentenceTransformers `all-MiniLM-L6-v2`, 384-dim —
no external embedding API). `scripts.seed` chunks `data/knowledge/*.md`, embeds, and fills
`knowledge_chunks`; retrieval orders by `embedding.cosine_distance(query)`.

## Rules & gotchas
- Config only via `app.config.settings` (pydantic-settings); nested env groups `GEMINI__*`,
  `RAG__*`, `LANGSMITH__*`. Tools stay thin; logic lives in services/repositories.
- Observability: LangSmith tracing is opt-in. `app/tracing.py:configure_tracing()` (called
  in the lifespan) maps the `LANGSMITH__*` settings group → native `LANGSMITH_*` env vars;
  it's a no-op unless `LANGSMITH__TRACING=true` and an API key are set. `ChatService` tags
  each turn's run (`support-chat-turn`, user/conversation metadata) via the `RunnableConfig`
  passed through `SupportAgent.stream_events`/`invoke`.
- `ChatService` opens its **own** DB sessions (not the request session) so streaming can
  persist after the response starts. Tools open their own sessions too.
- LLM is **Gemini** (`langchain-google-genai`, default `gemini-2.5-flash`). Tool calling is
  reliable, so the planner just `ainvoke`s the bound model — no recovery/retry workaround
  (the old Groq `<function=…>`/`tool_use_failed` mitigation was removed). Any hard LLM error
  (e.g. a Gemini 429) propagates from the planner to `ChatService`, which returns a clean
  503. The free tier has per-minute/per-day rate limits, so heavy testing can hit 429.
- `KnowledgeChunk.embedding` dim = `settings.rag.embedding_dim` (384); re-run `scripts.seed`
  if you change the model. MCP server is standalone (separate from the in-process tools).
