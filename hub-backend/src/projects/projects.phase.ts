import { ProjectPhase } from '../generated/prisma/client';

/** Quién da el visto bueno: el proponente del proyecto o un evaluador asignado. */
export type PhaseApprovalKind = 'proposer' | 'evaluator';

/** Aprobador exigido para poder avanzar de fase. */
export type RequiredPhaseApprover = {
  userId: number;
  fullName: string;
  kind: PhaseApprovalKind;
};

/**
 * Siguiente fase (semestre) de un proyecto, o `null` si ya está en la última.
 */
export function nextProjectPhase(phase: ProjectPhase): ProjectPhase | null {
  switch (phase) {
    case ProjectPhase.semester_1:
      return ProjectPhase.semester_2;
    case ProjectPhase.semester_2:
      return null;
  }
}

/**
 * Aprobadores exigidos para avanzar de fase: el proponente (si existe) y cada
 * evaluador asignado al proyecto. Si un usuario acumula ambos papeles se cuenta
 * una sola vez, como proponente.
 */
export function requiredPhaseApprovers(project: {
  proposerUserId: number | null;
  proposerFullName: string | null;
  evaluators: { userId: number; fullName: string }[];
}): RequiredPhaseApprover[] {
  const approvers: RequiredPhaseApprover[] = [];

  if (project.proposerUserId !== null && project.proposerFullName !== null) {
    approvers.push({
      userId: project.proposerUserId,
      fullName: project.proposerFullName,
      kind: 'proposer',
    });
  }

  for (const evaluator of project.evaluators) {
    if (!approvers.some((approver) => approver.userId === evaluator.userId)) {
      approvers.push({
        userId: evaluator.userId,
        fullName: evaluator.fullName,
        kind: 'evaluator',
      });
    }
  }

  return approvers;
}

/** Nombre y papel de cada aprobador pendiente, para los mensajes de error. */
export function formatPendingApprovers(
  approvers: RequiredPhaseApprover[],
): string {
  return approvers
    .map((approver) => `${approver.fullName} (${approver.kind})`)
    .join(', ');
}
