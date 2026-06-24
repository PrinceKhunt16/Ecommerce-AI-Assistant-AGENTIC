Next.js
   ↓
FastAPI + WebSockets
   ↓
LangGraph Supervisor
   ↓
Router Agent
RAG Agent
Product Agent
Order Agent
Human Agent
   ↓
Tools
   ↓
PostgreSQL + Redis + FAISS
   ↓
Gemini 2.5 Flash
   ↓
LangSmith + Guardrails
   ↓
Docker

# Ecommerce Support Chatbot — Backend

A single, focused **support chatbot for an online store**. Shoppers sign up, log in, and
chat: they can browse/ask about **products**, check the status and tracking of their own
**orders**, and get answers about **shipping / returns / refunds** (RAG). The agent
streams its **thinking, tool calls, and answer** to the frontend, Claude-Code style.

Built for learning **LangGraph + tools + MCP** on a clean **API → Services →
Repositories → Database** layering.

---

## 1. Stack

- **API** — FastAPI + Uvicorn (REST for auth/catalog · WebSocket for chat)
- **Agent** — LangGraph: `planner → executor → synthesizer`
- **LLM** — Gemini (free tier; `gemini-2.5-flash`)
- **Database** — PostgreSQL + **pgvector** (the only datastore)
- **RAG** — local SentenceTransformers embeddings → pgvector cosine search
- **Memory** — Redis (recent turns of the current conversation)
- **Auth** — JWT bearer tokens (register / login)
- **MCP** — standalone Postgres MCP server (stdio)
- **Tooling** — uv, Python 3.12

---

## 2. Prerequisites

- [uv](https://docs.astral.sh/uv/) installed
- Docker (for Postgres + Redis), **or** local Postgres 16 (`pgvector/pgvector:pg16`) + `redis-server`
- A free [Gemini API key](https://aistudio.google.com/apikey) for the agent. (Embeddings run
  locally/offline — no key needed.)

---

## 3. Run it (step by step)

```bash
# 0. From the backend/ directory.

# 1. Install dependencies (creates .venv; first run downloads the local embedding model).
uv sync --extra dev

# 2. Configuration
cp .env.example .env
#    Set GEMINI__API_KEY (free) and a JWT_SECRET in .env.
#    Optional: enable LangSmith tracing (see §9) — leave off if you don't need it.

# 3. Start infrastructure (Postgres + Redis)
docker compose -f docker/docker-compose.yml up -d postgres redis

# 4. Create the schema (pgvector extension + tables)
uv run python -m scripts.init_db

# 5. Seed products, a demo user with orders, and the knowledge base
uv run python -m scripts.seed
#    → demo login:  demo@example.com / demo1234

# 6. Run the API
uv run main.py
#    → Swagger UI:  http://localhost:8000/docs
#    → Liveness:    http://localhost:8000/api/v1/health
#    → Readiness:   http://localhost:8000/api/v1/ready   (checks DB + Redis)
```

Dev shortcut: set `DB_AUTO_CREATE=true` in `.env` to create tables on startup (you still
run `scripts.seed` for data).

---

## 4. Try it

```bash
# Register (or log in) → get a JWT
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"demo1234"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Browse products (public)
curl "localhost:8000/api/v1/products?query=headphones"

# Chat is WebSocket-only. Stream thinking + tool steps + answer over one socket.
# CLI: install `websocat`, send one JSON line, watch the events stream back.
echo '{"message":"How long do refunds take?","conversation_id":null}' \
  | websocat "ws://localhost:8000/api/v1/ws/chat?token=$TOKEN"
```

**Browser:**

```js
const ws = new WebSocket(`ws://localhost:8000/api/v1/ws/chat?token=${jwt}`);
ws.onopen = () => ws.send(JSON.stringify({ message: "How long do refunds take?", conversation_id: null }));
ws.onmessage = (e) => {
  const ev = JSON.parse(e.data); // ev.type: thinking|tool_call|tool_result|token|error|done
  if (ev.type === "token") appendToAnswer(ev.data);
};
```

### Event protocol

The socket stays open across turns. Each turn the server streams these typed events:

```
{"type":"thinking","data":"<text>"}                          planner reasoning
{"type":"tool_call","name":"get_my_orders","args":{}}        a tool is invoked
{"type":"tool_result","name":"get_my_orders","data":"..."}   its (truncated) output
{"type":"token","data":"<answer text>"}                      the reply, streamed
{"type":"done","conversation_id":"<uuid>"}                   turn finished
{"type":"error","data":"<message>"}                          turn failed (no `done` follows)
```

Save `conversation_id` from `done` and send it back to continue the same thread.

---

## 5. API reference (prefix `/api/v1`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | `/health` · `/ready` | public | probes |
| POST | `/auth/register` | public | create account → token + user |
| POST | `/auth/login` | public | log in → token + user |
| GET  | `/auth/me` | bearer | current user |
| GET  | `/products` · `/products/{id}` | public | browse / detail |
| WS   | `/ws/chat?token=` | bearer (query) | chat — streams thinking/tool/token/done events |
| GET  | `/orders` · `/orders/{id}` | bearer | your orders |
| GET  | `/conversations` · `/conversations/{id}` | bearer | your chat history |

---

## 6. How a chat turn works

1. The `token` query param on the WebSocket identifies the user (`decode_access_token`).
2. `ChatService` resolves/creates the conversation, loads recent turns from Redis, and
   sets a `current_user_id` ContextVar so order tools act only for that user.
3. The LangGraph agent runs **planner → executor (tools) → synthesizer**.
4. Events stream over the socket (thinking → tool_call → tool_result → token → done), then
   the turn is persisted to Postgres (`conversations` + `messages`). A failure mid-turn
   sends an `error` event instead of `done`; the socket stays open for the next message.

Tools: `search_products`, `get_product`, `get_my_orders`, `get_order_status`,
`search_knowledge_base`.

---

## 7. Project layout

```
main.py              # entrypoint + app factory
app/
├── config.py        # settings (pydantic-settings)
├── logging.py       # structlog → console + logs/logger.log
├── db.py            # async engine/session, Base, init_models
├── security.py      # password hashing, JWT, current-user dep, current_user_id ctxvar
├── errors.py        # exception handlers
├── middleware.py    # request-id + access logging
├── models/          # user, product, order, conversation, knowledge_chunk
├── schemas/         # Pydantic DTOs
├── repositories/    # data access (only layer touching the ORM)
├── services/        # auth, product, order, conversation, chat orchestration
├── memory/          # Redis short-term turn memory
├── rag/             # local embeddings, ingest, pgvector retriever
├── agent/           # llm, state, prompts, tools, graph, support_agent facade
├── api/             # deps, router, routes/
└── mcp/             # standalone Postgres MCP server
data/                # products.json + knowledge/*.md (seed sources)
scripts/             # init_db, seed
```

---

## 8. Common tasks

```bash
uv run pytest                                 # tests
uv run ruff check . && uv run mypy app        # lint + types
tail -f logs/logger.log                          # logs
```

---

## 9. Tracing (LangSmith)

The agent is instrumented for **[LangSmith](https://smith.langchain.com)** — every chat
turn shows up as a trace of the `planner → executor → synthesizer` graph (LLM calls, tool
calls, latency, token usage). It's **opt-in and off by default**; the app runs fine without
it.

To enable it, set these in `.env` (config flows through `app.config.settings` like
everything else; `app/tracing.py` translates the `LANGSMITH__*` group into the native
`LANGSMITH_*` env vars at startup):

```bash
LANGSMITH__TRACING=true
LANGSMITH__API_KEY=<your LangSmith key>     # from https://smith.langchain.com
LANGSMITH__PROJECT=ecommerce-support-chatbot
# LANGSMITH__ENDPOINT=https://api.smith.langchain.com   # override for EU / self-hosted
```

Tracing only activates when `LANGSMITH__TRACING=true` **and** an API key is set (otherwise
startup logs `tracing.disabled` / `tracing.skipped` and continues). Each turn's run is
named `support-chat-turn`, tagged `chat` / `websocket`, and carries `user_id` +
`conversation_id` metadata so you can filter runs per user/thread in the LangSmith UI.
