# Smart Support — Agent Console (frontend)

A simple Next.js operator console for the **Smart Support Agent** backend. It exercises
the AI customer-care API end to end: streaming chat across the chat/voice/email channels,
ticket management, and conversation history inspection.

## Design

- **Square-ish UI** — global border radius is `0`, so buttons, cards, inputs, and pills
  are crisp squares.
- **Averta** as the UI font (loaded locally via `next/font/local` from `src/fonts/`).
- Built with **shadcn/ui** (base-nova, neutral palette) on Tailwind CSS v4.

## Features

| Page | Route | What it does | API used |
| --- | --- | --- | --- |
| Chat | `/` | Streaming (SSE) or full replies; channel selector (chat/voice/email); optional `user_id` for long-term memory; shows `intent`, `tools_used`, `escalated` | `POST /chat`, `POST /chat/stream`, `POST /voice`, `POST /email` |
| Tickets | `/tickets` | Create a ticket, look one up by ID, and update status/priority/assignee | `POST /ticket/create`, `GET /ticket/{id}`, `POST /ticket/update` |
| Conversations | `/conversations` | Fetch a conversation by ID and view its persisted message history + summary | `GET /conversation/{id}` |
| Status | sidebar | Live backend health indicator (polls every 15s) | `GET /ready` |

The chat page generates the `conversation_id` client-side so a streamed conversation
(whose response carries only tokens, not the id) can still be continued and opened on the
Conversations page.

## Getting started

```bash
npm install        # if not already installed
npm run dev        # http://localhost:3000
```

The backend must be running and must allow this origin. Its dev default
(`CORS_ORIGINS=["http://localhost:3000"]`, `AUTH_ENABLED=false`) already matches, so no
extra setup is needed — start the FastAPI server on `:8000` and the console connects.

## Configuration

Copy `.env.example` to `.env.local` (already present with defaults) and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend origin |
| `NEXT_PUBLIC_API_PREFIX` | `/api/v1` | API prefix |
| `NEXT_PUBLIC_API_KEY` | _(unset)_ | Only needed if the backend runs with `AUTH_ENABLED=true`; sent as `X-API-Key` |

## Notes

- **Tickets need a real `user_id`** — the backend FK-enforces it. Seed users with the
  backend's `scripts.seed_data` and read the UUIDs from Postgres.
- **Streaming hides metadata** — `/chat/stream` only returns tokens, so `intent`/
  `tools_used` badges appear only on non-streamed replies. Toggle streaming off to see them.
- `npm run build` type-checks, lints, and produces a production build.

## Structure

```
src/
  app/                     # routes: / (chat), /tickets, /conversations
  components/
    app-shell.tsx          # sidebar + nav
    system-status.tsx      # /ready poller
    chat/                  # chat console
    tickets/               # ticket create/manage + status pills
    conversations/         # conversation viewer
    ui/                    # shadcn components
  lib/
    api.ts                 # typed client (incl. SSE stream reader)
    config.ts  types.ts  format.ts
  fonts/                   # Averta.woff2 / .otf
```
