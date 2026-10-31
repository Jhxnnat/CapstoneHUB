"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-provider";
import PageFrame from "../components/page-frame";
import AssignedProjects from "./assigned-projects";
import ChangePasswordForm from "./change-password-form";
import InterestedProjects from "./interested-projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRole, getInitials } from "../services/utils";
import { canViewKpis } from "../services/stats";

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
      <main className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
        <div className="utb-skeleton h-44 w-full rounded-3xl" />
      </main>
    );
  }

  if (!isAuthenticated || !session) {
    return null;
  }

  const { user } = session;

  const showKpis = canViewKpis(user.roles);
  const isStudent = user.roles.includes("student");

  return (
    <PageFrame
      eyebrow="Mi cuenta"
      title="Mi perfil"
      accentColor="rgba(16,185,129,0.28)"
    >
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

        {showKpis ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Panel de indicadores</CardTitle>
              <CardDescription>
                Consulta pendientes, la distribución de tus proyectos y tu
                actividad de revisión.
              </CardDescription>

              <CardAction>
                <Button
                  nativeButton={false}
                  render={<Link href="/profile/kpis">Ver panel</Link>}
                />
              </CardAction>
            </CardHeader>
          </Card>
        ) : null}

      <ChangePasswordForm />

      <AssignedProjects />

      {isStudent ? <InterestedProjects /> : null}
    </PageFrame>
  );
}
