# Support Assistant — Console (frontend)

A Next.js console for the **Ecommerce Support Chatbot** backend. Shoppers sign in, then
chat with the AI agent (it streams its **thinking, tool calls, and answer** live over a
WebSocket), browse the **product** catalog, track their own **orders**, and revisit past
**conversations** — exercising the backend API end to end.

## Design

- **Square-ish UI** — global border radius is `0`, so buttons, cards, inputs, and pills
  are crisp squares.
- **Averta** as the UI font (loaded locally via `next/font/local` from `src/fonts/`).
- Built with **shadcn/ui** (neutral palette) on **Tailwind CSS v4**, **Next.js 16** /
  **React 19**.

## Auth

The whole app sits behind an **auth gate** — until you sign in you see only a login /
register card. Auth is **JWT bearer**: `POST /auth/login` or `POST /auth/register` returns a
token, which is stored in `localStorage` (`cc_token`) and sent as `Authorization: Bearer
<token>` on every request, and as a `?token=` query param on the chat WebSocket (browsers
can't set an `Authorization` header on a socket).

Register a new account, or use the backend's seeded demo login: **`demo@example.com` /
`demo1234`** (created by the backend's `scripts.seed`).

## Features

| Page | Route | What it does | API used |
| --- | --- | --- | --- |
| Chat | `/` | Live agent chat over one WebSocket. Streams `thinking` → `tool_call`/`tool_result` → `token` → `done`; shows the tool steps inline; continues a thread via the `conversation_id` from `done`; suggestion chips + "new chat" | `WS /ws/chat?token=` |
| Products | `/products` | Browse the catalog; filter by search query / category | `GET /products` |
| Orders | `/orders` | Your orders with status + tracking number | `GET /orders`, `GET /orders/{id}` |
| Conversations | `/conversations` | List your conversations and view a thread's persisted message history; deep-linkable via `?id=<conversation_id>` | `GET /conversations`, `GET /conversations/{id}` |
| Status | sidebar | Backend readiness indicator (DB + Redis), checked on load | `GET /ready` |

Chat is **WebSocket-only** (`ChatSocket` in [src/lib/chat-socket.ts](src/lib/chat-socket.ts)):
one connection is opened and reused across turns. Each turn sends `{ message,
conversation_id }` and receives a stream of typed events terminated by `done` (carrying the
`conversation_id` to continue the thread) or `error`. A failed turn surfaces the error but
keeps the socket open for the next message.

## Getting started

```bash
npm install        # if not already installed
npm run dev        # http://localhost:3000
```

The backend must be running on `:8000` and must allow this origin. Its dev defaults
(`CORS_ORIGINS=["http://localhost:3000"]`) already match, so once the FastAPI server is up
the console connects. Sign in with the seeded demo account or register a new one.

## Configuration

Copy `.env.example` to `.env.local` (already present with defaults) and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend origin (also derives the `ws://` chat URL) |
| `NEXT_PUBLIC_API_PREFIX` | `/api/v1` | API prefix |

Authentication is handled in-app via login / register — no API key to configure.

## Notes

- **Sign in first.** Every page (chat, orders, conversations) needs a JWT; the catalog is
  public on the backend but the console still gates it behind login.
- **The agent thinks out loud.** `thinking` and tool steps render inline as the turn runs,
  so you can watch the `planner → executor → synthesizer` work, not just the final answer.
- `npm run build` type-checks and produces a production build; `npm run lint` runs ESLint.

## Structure

```
src/
  app/                       # routes: / (chat), /products, /orders, /conversations
  components/
    app-shell.tsx            # sidebar + nav + auth gating
    page-header.tsx
    system-status.tsx        # /ready indicator (DB + Redis)
    auth/                    # auth provider + login/register gate
    chat/                    # chat console + markdown renderer
    products/                # catalog browser
    orders/                  # orders + status badges
    conversations/           # conversation list + viewer
    ui/                      # shadcn components
  lib/
    api.ts                   # typed REST client (auth/products/orders/conversations/health)
    chat-socket.ts           # WebSocket client for the agent chat
    token.ts                 # JWT storage (localStorage)
    config.ts  types.ts  format.ts  utils.ts
  fonts/                     # Averta.woff2 / .otf
```
