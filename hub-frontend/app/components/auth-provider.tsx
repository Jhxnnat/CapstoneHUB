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
  saveAuthSession,
} from "../services/auth";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  ready: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
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
      logout: () => {
        clearAuthSession();
        setSession(null);
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