"use client";

import { useMemo, useState, useTransition } from "react";
import { ProjectDetails } from "../../services/schemas";
import {
  approveProjectPhase,
  revokeProjectPhaseApproval,
} from "../../services/projects";
import { useAuth } from "../../components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RiCheckLine, RiTimeLine } from "@remixicon/react";

type ProjectPhaseApprovalsProps = {
  readonly project: ProjectDetails;
  readonly onProjectChange: () => Promise<void>;
};

/**
 * Visto bueno de fase: muestra quién aprobó y quién falta, y permite al
 * proponente o a un evaluador asignado dar o retirar su aprobación.
 */
export default function ProjectPhaseApprovals({
  project,
  onProjectChange,
}: ProjectPhaseApprovalsProps) {
  const { session } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const approvals = project.phaseApprovals;
  const currentUserId = session?.user.id;

  const mine = useMemo(
    () =>
      approvals?.required.find(
        (approver) => approver.userId === currentUserId,
      ),
    [approvals, currentUserId],
  );

  if (
    project.status !== "in_progress" ||
    approvals?.nextPhase == null ||
    approvals.required.length === 0
  ) {
    return null;
  }

  function handleAction(approve: boolean) {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        if (approve) {
          await approveProjectPhase(String(project.id));
        } else {
          await revokeProjectPhaseApproval(String(project.id));
        }
        await onProjectChange();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el visto bueno de fase",
        );
      }
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Visto bueno de fase</span>

      {approvals.required.map((approver) => (
        <Badge
          key={approver.userId}
          variant={approver.approvedAt ? "secondary" : "outline"}
        >
          {approver.approvedAt ? (
            <RiCheckLine className="text-success" />
          ) : (
            <RiTimeLine />
          )}
          {approver.fullName} ·{" "}
          {approver.kind === "proposer" ? "proponente" : "evaluador"}
        </Badge>
      ))}

      {mine ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleAction(mine.approvedAt == null)}
        >
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          {mine.approvedAt ? "Retirar visto bueno" : "Dar visto bueno"}
        </Button>
      ) : null}

      {errorMessage ? (
        <span className="text-xs font-medium text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
