"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";
import { Button } from "@/components/ui/button";

export function AuthNav() {

  const { session, isAuthenticated, ready, logout } = useAuth();

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    evaluator: "Evaluador",
    coordinator: "Coordinador",
    advisor: "Asesor",
    student: "Estudiante",
  };

  const userRoles = (session?.user.roles ?? [])
    .map((role) => roleLabels[role] ?? role)
    .join(", ");

    return (
        <div className="ml-auto flex shrink-0 items-center gap-3">
            {!ready ? (
            <span className="text-sm text-slate-500">Cargando...</span>
            ) : isAuthenticated ? (
            <>
                <span className="hidden text-right text-sm text-slate-700 sm:inline">
                <span className="block font-medium">{session?.user.fullName}</span>
                <span className="block text-xs text-slate-500">
                    {userRoles || "Sin rol asignado"}
                </span>
                </span>
                <Button
                variant="outline"
                onClick={logout}
                className="inline-flex items-center justify-center border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                Cerrar sesión
                </Button>
            </>
            ) : (
            <Link
                href="/login"
                className="inline-flex items-center justify-center bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
                Iniciar sesión
            </Link>
            )}
        </div>
    )
}