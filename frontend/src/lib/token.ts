// Minimal JWT storage shared by the API layer and the auth context.
// The backend issues a bearer token (POST /auth/login|register); we keep it in
// localStorage and send it as `Authorization: Bearer <token>`. SSR-safe.

const TOKEN_KEY = "cc_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode / quota) — token simply won't persist
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
