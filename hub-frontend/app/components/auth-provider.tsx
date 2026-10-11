"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthSession,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
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

  // Hidrata la sesión desde la cookie httpOnly (vía BFF) al montar.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const user = await getCurrentUser();

        if (active) {
          setSession(user ? { user } : null);
        }
      } catch {
        if (active) {
          setSession(null);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Ante un 401 con la cookie vencida, el BFF ya la limpió al reenviar la
  // respuesta; aquí se limpia el estado y se envía al login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
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
        const user = await loginUser(payload);
        setSession({ user });
      },
      register: async (payload) => {
        const user = await registerUser(payload);
        setSession({ user });
      },
      logout: () => {
        setSession(null);

        if (window.location.pathname === "/login") {
          void logoutUser().catch(() => undefined);
          return;
        }

        void logoutUser()
          .catch(() => undefined)
          .finally(() => window.location.assign("/login"));
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
