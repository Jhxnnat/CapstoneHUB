"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthSession,
  clearAuthSession,
  loadAuthSession,
  loginUser,
  registerUser,
  saveAuthSession,
} from "../services/auth";
import { setUnauthorizedHandler } from "@/lib/http";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  ready: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setSession(loadAuthSession());
      setReady(true);
    });

    function handleStorage(event: StorageEvent) {
      if (event.key === "capstonehub.auth.session") {
        setSession(loadAuthSession());
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Ante un 401 con sesión guardada, la cierra y envía al login con la ruta
  // actual para volver allí después de autenticarse.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!loadAuthSession()) {
        return;
      }

      clearAuthSession();
      setSession(null);

      const { pathname, search } = window.location;

      if (pathname === "/login") {
        return;
      }

      const next = encodeURIComponent(`${pathname}${search}`);
      window.location.assign(`/login?next=${next}`);
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      ready,
      login: async (payload) => {
        const nextSession = await loginUser(payload);
        saveAuthSession(nextSession);
        setSession(nextSession);
      },
      register: async (payload) => {
        const nextSession = await registerUser(payload);
        saveAuthSession(nextSession);
        setSession(nextSession);
      },
      logout: () => {
        clearAuthSession();
        setSession(null);

        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
      },
    }),
    [ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}