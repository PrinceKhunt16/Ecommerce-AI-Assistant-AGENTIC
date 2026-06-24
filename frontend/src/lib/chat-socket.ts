// WebSocket client for the agent chat endpoint.
//
// The backend exposes a single socket — WS /api/v1/ws/chat?token=<jwt> — that
// carries many turns. We keep one connection open and reuse it: each turn sends
// { message, conversation_id } and receives a stream of typed events
// (thinking / tool_call / tool_result / token) terminated by `done` or `error`.
// A failed turn surfaces `error` but never drops the socket, so the next turn
// reuses the same connection. Auth rides in the query string because browsers
// can't set an Authorization header on a WebSocket.

import { wsUrl } from "./config";
import { getToken } from "./token";
import type { ChatRequest, StreamEvent } from "./types";

export interface ChatTurnHandlers {
  onThinking?: (text: string) => void;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, data: unknown) => void;
  onToken?: (token: string) => void;
  onDone?: (conversationId: string) => void;
  onError?: (message: string) => void;
}

export class ChatSocket {
  private ws: WebSocket | null = null;
  private connecting: Promise<WebSocket> | null = null;
  // Handlers and resolver for the turn currently in flight (one at a time).
  private active: ChatTurnHandlers | null = null;
  private settle: (() => void) | null = null;
  // Set when we close on purpose, so the resulting `onclose` isn't treated as
  // a dropped connection.
  private intentionallyClosed = false;

  /**
   * Send one turn and route its events to `handlers`. The returned promise
   * resolves when the turn ends — a `done`/`error` event, or a dropped
   * connection — and never rejects (failures are reported via `onError`).
   */
  async send(req: ChatRequest, handlers: ChatTurnHandlers): Promise<void> {
    let ws: WebSocket;
    try {
      ws = await this.open();
    } catch (e) {
      if (this.intentionallyClosed) return;
      handlers.onError?.(
        e instanceof Error ? e.message : "Could not connect to the agent.",
      );
      return;
    }
    return new Promise<void>((resolve) => {
      this.active = handlers;
      this.settle = resolve;
      try {
        ws.send(
          JSON.stringify({
            message: req.message,
            conversation_id: req.conversation_id ?? null,
          }),
        );
      } catch {
        this.active = null;
        this.settle = null;
        handlers.onError?.("Could not send your message.");
        resolve();
      }
    });
  }

  /** Close the socket and abort any in-flight turn without surfacing an error. */
  close(): void {
    this.intentionallyClosed = true;
    this.active = null;
    this.settle?.();
    this.settle = null;
    this.connecting = null;
    this.ws?.close();
    this.ws = null;
  }

  // Resolve to an open socket, opening one (and waiting for `open`) if needed.
  private open(): Promise<WebSocket> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve(this.ws);
    if (this.connecting) return this.connecting;

    const token = getToken();
    if (!token) {
      return Promise.reject(
        new Error("You're signed out — please sign in again."),
      );
    }

    this.intentionallyClosed = false;
    const ws = new WebSocket(
      `${wsUrl("/ws/chat")}?token=${encodeURIComponent(token)}`,
    );
    this.ws = ws;
    ws.onmessage = (e) => {
      if (typeof e.data === "string") this.dispatch(e.data);
    };

    this.connecting = new Promise<WebSocket>((resolve, reject) => {
      ws.onopen = () => {
        this.connecting = null;
        resolve(ws);
      };
      ws.onclose = () => {
        this.connecting = null;
        // No-op once the socket has opened (this promise is already settled).
        reject(new Error("Could not connect to the agent."));
        this.handleClose(ws);
      };
    });
    return this.connecting;
  }

  private dispatch(raw: string): void {
    let ev: StreamEvent;
    try {
      ev = JSON.parse(raw) as StreamEvent;
    } catch {
      return;
    }
    const h = this.active;
    switch (ev.type) {
      case "thinking":
        h?.onThinking?.(ev.data);
        break;
      case "tool_call":
        h?.onToolCall?.(ev.name, ev.args);
        break;
      case "tool_result":
        h?.onToolResult?.(ev.name, ev.data);
        break;
      case "token":
        h?.onToken?.(ev.data);
        break;
      case "done":
        this.endTurn(() => h?.onDone?.(ev.conversation_id));
        break;
      case "error":
        this.endTurn(() => h?.onError?.(ev.data));
        break;
    }
  }

  // Finish the in-flight turn: emit its terminal callback, then resolve send().
  private endTurn(emit: () => void): void {
    const settle = this.settle;
    this.active = null;
    this.settle = null;
    emit();
    settle?.();
  }

  // The socket dropped. Fail any in-flight turn unless we closed on purpose.
  private handleClose(ws: WebSocket): void {
    if (this.ws === ws) this.ws = null;
    const h = this.active;
    const settle = this.settle;
    this.active = null;
    this.settle = null;
    if (!this.intentionallyClosed) {
      h?.onError?.("Connection lost. Please try again.");
    }
    settle?.();
  }
}
