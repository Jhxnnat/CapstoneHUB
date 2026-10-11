"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-provider";
import ModuleHeader from "../components/module-header";
import AssignedProjects from "./assigned-projects";
import ChangePasswordForm from "./change-password-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRole, getInitials } from "../services/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { session, ready, isAuthenticated } = useAuth();

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace("/login");
    }
  }, [ready, isAuthenticated, router]);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="utb-skeleton h-44 w-full rounded-3xl" />
      </main>
    );
  }

  if (!isAuthenticated || !session) {
    return null;
  }

  const { user } = session;

  return (
    <main className="flex-1 text-foreground">
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ModuleHeader
          eyebrow="Mi cuenta"
          title="Mi perfil"
          subtitle="Consulta tu información y los proyectos en los que participas."
          accentColor="rgba(16,185,129,0.28)"
        />

        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-utb-blue/10 text-lg font-bold text-utb-blue ring-1 ring-utb-blue/15">
                  {getInitials(user.fullName)}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold tracking-tight">
                    {user.fullName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="min-w-0 sm:text-right">
                <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                  Roles
                </p>
                <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                  {user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {formatRole(role)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin rol asignado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ChangePasswordForm />

        <AssignedProjects />
      </section>
    </main>
  );
}
