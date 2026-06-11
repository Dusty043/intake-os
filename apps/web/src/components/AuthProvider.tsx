"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getAuthMe, logout as apiLogout } from "@/lib/auth-client";
import type { AuthMeResponse, AuthMode, AuthUser } from "@/lib/auth-client";

interface AuthContextValue {
  authenticated: boolean;
  authMode: AuthMode;
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  authenticated: false,
  authMode: "dev_headers",
  user: null,
  isLoading: true,
  logout: async () => undefined,
  refresh: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AuthContextValue, "logout" | "refresh">>({
    authenticated: false,
    authMode: "dev_headers",
    user: null,
    isLoading: true,
  });

  const fetchMe = useCallback(async () => {
    try {
      const data: AuthMeResponse = await getAuthMe();
      setState({
        authenticated: data.authenticated,
        authMode: data.authMode ?? "dev_headers",
        user: data.user ?? null,
        isLoading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState((prev) => ({ ...prev, authenticated: false, user: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, logout, refresh: fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
