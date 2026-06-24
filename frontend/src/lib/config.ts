// Central config for talking to the Ecommerce Support Chatbot backend.
// Defaults match the backend's local dev setup (FastAPI on :8000, /api/v1 prefix).
// Override via .env.local with NEXT_PUBLIC_* vars.

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api/v1";

export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${suffix}`;
}

// WebSocket URL for /ws/chat (http -> ws, https -> wss).
export function wsUrl(path: string): string {
  const base = apiUrl(path);
  return base.replace(/^http/, "ws");
}
