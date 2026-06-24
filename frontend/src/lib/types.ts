// Types mirroring the Ecommerce Support Chatbot backend schemas.
// Read shapes are modeled from the README column tables and kept defensive
// (optional fields, price as number|string, optional nested product on orders).

// ---- Auth & users -------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name?: string | null;
  created_at?: string;
}

export interface RegisterRequest {
  email: string;
  name?: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ---- Catalog ------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number | string;
  category: string;
  image_url?: string | null;
  created_at?: string;
}

// ---- Orders -------------------------------------------------------------

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  id: string;
  user_id: string;
  product_id: string;
  status: OrderStatus;
  tracking_number: string | null;
  created_at?: string;
  updated_at?: string;
  // Some backends embed the product / its name on the order read — tolerate both.
  product?: Product | null;
  product_name?: string | null;
}

// ---- Chat ---------------------------------------------------------------

// Sent over the WebSocket per turn. `conversation_id` is null for a new thread,
// or the id from the previous turn's `done` event to continue the same one.
export interface ChatRequest {
  message: string;
  conversation_id?: string | null;
}

// ---- Conversations ------------------------------------------------------

export interface MessageRead {
  id: string;
  role: string; // user | assistant | tool | system
  content: string;
  timestamp: string;
}

export interface ConversationSummary {
  id: string;
  user_id?: string | null;
  title: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationRead extends ConversationSummary {
  messages: MessageRead[];
}

// ---- Health -------------------------------------------------------------

export interface HealthResponse {
  status: string;
  app?: string;
  env?: string;
}

export interface ReadyResponse {
  status: "ready" | "degraded";
  checks: {
    database: boolean | string;
    redis: boolean | string;
  };
}

// ---- Chat stream events (WS /ws/chat) -----------------------------------
// The agent emits typed events as it works. Per turn the order is:
//   thinking / tool_call / tool_result  — zero or more, the agent's work
//   token                               — many, the streamed customer answer
//   done                                — terminal, carries the conversation_id
// On failure an `error` is emitted instead of `done`; the socket stays open
// for the next turn. `data` is always a string.
//   thinking     — planner reasoning (the agent thinking about next steps)
//   tool_call    — a tool was invoked, with its args
//   tool_result  — a tool returned data (truncated by the backend)
//   token        — a token of the final, customer-facing answer
//   error        — the turn failed; the message is in `data`

export type StreamEvent =
  | { type: "thinking"; data: string }
  | { type: "tool_call"; name: string; args?: unknown }
  | { type: "tool_result"; name: string; data?: unknown }
  | { type: "token"; data: string }
  | { type: "done"; conversation_id: string }
  | { type: "error"; data: string };
