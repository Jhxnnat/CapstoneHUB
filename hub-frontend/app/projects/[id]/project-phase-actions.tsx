"use client";

import { useMemo, useState, useTransition } from "react";
import { ProjectDetails } from "../../services/schemas";
import { formatPhase } from "../../services/utils";
import { advanceProjectPhase } from "../../services/projects";
import { useAuth } from "../../components/auth-provider";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RiArrowRightLine } from "@remixicon/react";

type ProjectPhaseActionsProps = {
  readonly project: ProjectDetails;
  readonly assignments: NonNullable<ProjectDetails["actorAssignments"]>;
  readonly onProjectChange: () => Promise<void>;
};

/**
 * Control compacto para avanzar el proyecto al siguiente semestre. Solo se
 * muestra a administradores y coordinadores asignados mientras el proyecto está
 * en progreso; exige que los hitos mínimos de la fase actual estén completos.
 */
export default function ProjectPhaseActions({
  project,
  assignments,
  onProjectChange,
}: ProjectPhaseActionsProps) {
  const { session } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = useMemo(() => {
    if (!session) {
      return false;
    }

    if (session.user.roles.includes("admin")) {
      return true;
    }

    return (
      session.user.roles.includes("coordinator") &&
      assignments.some(
        (assignment) =>
          assignment.userId === session.user.id &&
          assignment.role === "coordinator",
      )
    );
  }, [session, assignments]);

  const currentPhase = project.phase ?? null;

  const pendingMinimums = useMemo(
    () =>
      (project.milestones ?? []).filter(
        (milestone) =>
          milestone.isMinimum &&
          !milestone.completed &&
          (milestone.phase === currentPhase || milestone.phase == null),
      ),
    [project.milestones, currentPhase],
  );

  const pendingApprovals = useMemo(
    () =>
      (project.phaseApprovals?.required ?? []).filter(
        (approver) => approver.approvedAt == null,
      ),
    [project.phaseApprovals],
  );

  if (!canManage || project.status !== "in_progress") {
    return null;
  }

  const isFinalPhase = currentPhase === "semester_2";
  const nextLabel =
    currentPhase === "semester_1" ? "Semestre 2" : "siguiente fase";

  function handleAdvanceClick() {
    if (pendingMinimums.length > 0) {
      setErrorMessage(
        `No puedes avanzar de fase: hay hitos mínimos pendientes (${pendingMinimums
          .map((milestone) => milestone.title)
          .join(", ")}).`,
      );
      return;
    }

    if (pendingApprovals.length > 0) {
      setErrorMessage(
        `No puedes avanzar de fase: falta el visto bueno de ${pendingApprovals
          .map((approver) => approver.fullName)
          .join(", ")}.`,
      );
      return;
    }

    setErrorMessage(null);
    setConfirmOpen(true);
  }

  function handleAdvance() {
    setConfirmOpen(false);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await advanceProjectPhase(String(project.id));
        await onProjectChange();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo avanzar la fase del proyecto",
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Fase</span>
      <Badge variant="outline">{formatPhase(currentPhase)}</Badge>

      {isFinalPhase ? (
        <span className="text-xs text-muted-foreground">Fase final</span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdvanceClick}
          disabled={isPending}
        >
          {isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiArrowRightLine data-icon="inline-start" />
          )}
          {isPending ? "Avanzando..." : `Avanzar a ${nextLabel}`}
        </Button>
      )}

      {errorMessage ? (
        <span className="text-xs font-medium text-destructive">
          {errorMessage}
        </span>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avanzar de fase</AlertDialogTitle>
            <AlertDialogDescription>
              El proyecto pasará de {formatPhase(currentPhase)} a {nextLabel}. La
              acción se registrará en el historial de cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdvance}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
