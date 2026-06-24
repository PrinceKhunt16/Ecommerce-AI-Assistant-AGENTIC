// Typed client for the Ecommerce Support Chatbot backend.

import { apiUrl } from "./config";
import { getToken } from "./token";
import type {
  AuthResponse,
  ConversationRead,
  ConversationSummary,
  HealthResponse,
  LoginRequest,
  Order,
  Product,
  ReadyResponse,
  RegisterRequest,
  User,
} from "./types";

// The backend's uniform error envelope: { detail, code, request_id, errors? }.
export class ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;

  constructor(status: number, message: string, code?: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || "Request failed";
  let code: string | undefined;
  let requestId: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.errors) && body.errors.length) {
      detail = body.errors
        .map((e: { loc?: string[]; msg?: string }) =>
          e?.loc ? `${e.loc.join(".")}: ${e.msg}` : e?.msg,
        )
        .filter(Boolean)
        .join("; ");
    } else if (Array.isArray(body?.detail) && body.detail.length) {
      // FastAPI validation errors come back as detail: [{loc, msg}, ...]
      detail = body.detail
        .map((e: { loc?: string[]; msg?: string }) =>
          e?.loc ? `${e.loc.join(".")}: ${e.msg}` : e?.msg,
        )
        .filter(Boolean)
        .join("; ");
    }
    code = body?.code;
    requestId = body?.request_id;
  } catch {
    // non-JSON body; keep statusText
  }
  return new ApiError(res.status, detail, code, requestId);
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(headers as Record<string, string> | undefined),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---- Auth ---------------------------------------------------------------

export const register = (req: RegisterRequest) =>
  request<AuthResponse>("/auth/register", { method: "POST", json: req });

export const login = (req: LoginRequest) =>
  request<AuthResponse>("/auth/login", { method: "POST", json: req });

export const getMe = () => request<User>("/auth/me");

// ---- Products (public) --------------------------------------------------

export const getProducts = (opts?: { query?: string; category?: string }) =>
  request<Product[]>(
    `/products${query({ query: opts?.query, category: opts?.category })}`,
  );

export const getProduct = (id: string) =>
  request<Product>(`/products/${encodeURIComponent(id)}`);

// ---- Orders (bearer, user-scoped) --------------------------------------

export const getOrders = () => request<Order[]>("/orders");

export const getOrder = (id: string) =>
  request<Order>(`/orders/${encodeURIComponent(id)}`);

// ---- Chat ---------------------------------------------------------------
// Chat is a WebSocket, not a REST call — see lib/chat-socket.ts (ChatSocket).

// ---- Conversations (bearer, user-scoped) -------------------------------

export const getConversations = () =>
  request<ConversationSummary[]>("/conversations");

export const getConversation = (id: string) =>
  request<ConversationRead>(`/conversations/${encodeURIComponent(id)}`);

// ---- Health -------------------------------------------------------------

export const getHealth = () => request<HealthResponse>("/health");
export const getReady = () => request<ReadyResponse>("/ready");
