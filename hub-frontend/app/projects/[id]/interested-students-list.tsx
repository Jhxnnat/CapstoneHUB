"use client";

import { type ReactNode, useEffect, useState, useTransition } from "react";
import {
  addProjectActorAssignment,
  dismissProjectInterest,
  getProjectInterests,
} from "../../services/projects";
import { ProjectInterestItem } from "../../services/schemas";
import { formatDate } from "./project-formatters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInitials } from "../../services/utils";
import { SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/http";
import ServiceUnavailable from "../../components/service-unavailable";

type InterestedStudentsListProps = {
  readonly projectId: number;
  /** Cambia cuando otra acción del panel asigna a alguien. */
  readonly refreshKey?: number;
  readonly onProjectChange: () => Promise<void>;
};

type PendingAction = {
  kind: "assign" | "dismiss";
  interest: ProjectInterestItem;
};

/**
 * Estudiantes que expresaron interés en el proyecto. Solo se renderiza para
 * quienes pueden asignar actores; asignar convierte el interés en una
 * asignación y descartarlo elimina el registro.
 */
export default function InterestedStudentsList({
  projectId,
  refreshKey = 0,
  onProjectChange,
}: InterestedStudentsListProps) {
  const [interests, setInterests] = useState<ProjectInterestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function loadInterests() {
      setLoading(true);
      setLoadError(null);

      const { interests: nextInterests, error: nextError } =
        await getProjectInterests(projectId);

      if (!active) {
        return;
      }

      setInterests(nextInterests);
      setLoadError(nextError ?? null);
      setLoading(false);
    }

    void loadInterests();

    return () => {
      active = false;
    };
  }, [projectId, reloadKey, refreshKey]);

  function handleConfirm() {
    if (!pendingAction) {
      return;
    }

    const { kind, interest } = pendingAction;
    setActionError(null);

    startTransition(async () => {
      try {
        if (kind === "assign") {
          await addProjectActorAssignment(projectId, {
            userId: interest.user.id,
            role: "student",
          });
          await onProjectChange();
        } else {
          await dismissProjectInterest(projectId, interest.id);
        }

        setInterests((current) =>
          current.filter((item) => item.id !== interest.id),
        );
        setPendingAction(null);
        setReloadKey((key) => key + 1);
      } catch (error) {
        setPendingAction(null);
        setActionError(
          error instanceof Error
            ? error.message
            : "No se pudo completar la acción.",
        );
      }
    });
  }

  // El panel solo aparece cuando hay estudiantes interesados. Mientras se
  // carga (o si no hay ninguno) no ocupa espacio en la pestaña Equipo.
  if (loading && interests.length === 0) {
    return null;
  }

  if (!loadError && interests.length === 0) {
    return null;
  }

  let content: ReactNode;

  if (loadError === SERVICE_UNAVAILABLE_MESSAGE) {
    content = (
      <ServiceUnavailable
        message={loadError}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  } else if (loadError) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  } else {
    content = (
      <div className="flex flex-col gap-3">
        {interests.map((interest) => (
          <div
            key={interest.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-start"
          >
            <Avatar>
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {getInitials(interest.user.fullName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {interest.user.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(interest.createdAt)}
                </p>
              </div>

              <p className="truncate text-sm text-muted-foreground">
                {interest.user.email}
              </p>

              {interest.message ? (
                <p className="mt-2 text-sm whitespace-pre-line text-foreground">
                  {interest.message}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sin mensaje.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() =>
                  setPendingAction({ kind: "assign", interest })
                }
                disabled={isPending}
              >
                Asignar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPendingAction({ kind: "dismiss", interest })
                }
                disabled={isPending}
              >
                Descartar
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estudiantes interesados</CardTitle>
        <CardDescription>
          {interests.length > 0
            ? `${interests.length} estudiante(s) quieren participar. Asignar a uno elimina su interés.`
            : "No se pudieron cargar los estudiantes interesados."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
        {content}
      </CardContent>

      <AlertDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === "assign"
                ? "Asignar estudiante"
                : "Descartar interés"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "assign"
                ? `Se asignará a ${pendingAction.interest.user.fullName} como estudiante del proyecto.`
                : `Se eliminará el interés de ${pendingAction?.interest.user.fullName}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending
                ? "Procesando..."
                : pendingAction?.kind === "assign"
                  ? "Asignar"
                  : "Descartar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
