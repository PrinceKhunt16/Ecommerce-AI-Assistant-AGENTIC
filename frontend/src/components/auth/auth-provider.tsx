"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { ApiError, getMe, login as apiLogin, register as apiRegister } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/token";
import type { LoginRequest, RegisterRequest, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  register: (req: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Starts true: on first client render we don't yet know if a stored token is valid.
  const [loading, setLoading] = useState(true);

  // Hydrate/validate a stored token on mount.
  useEffect(() => {
    let active = true;
    const init = async () => {
      const token = getToken();
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (active) setUser(me);
      } catch (e) {
        // Invalid/expired token — drop it.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          clearToken();
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await apiLogin(req);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (req: RegisterRequest) => {
    const res = await apiRegister(req);
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
