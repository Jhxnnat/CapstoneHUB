import {
  ActorRole,
  Prisma,
  ProjectPhase,
  ProjectSource,
  ProjectStatus,
  ReportStatus,
  UserRole,
} from '../generated/prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  ProjectAttachmentResponse,
  attachmentSelect,
  mapAttachment,
} from '../attachments/attachments.select';
import {
  ProjectReportResponse,
  mapReport,
  reportSelect,
} from '../reports/reports.select';
import {
  PhaseApprovalKind,
  nextProjectPhase,
  requiredPhaseApprovers,
} from './projects.phase';

const projectStatusHistorySelect = {
  id: true,
  projectId: true,
  previousStatus: true,
  nextStatus: true,
  description: true,
  changedAt: true,
  authorUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} as const satisfies Prisma.ProjectStatusHistorySelect;

const projectObservationSelect = {
  id: true,
  projectId: true,
  content: true,
  createdAt: true,
  authorUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} as const satisfies Prisma.ProjectObservationSelect;

const projectChangeHistorySelect = {
  id: true,
  projectId: true,
  field: true,
  previousValue: true,
  newValue: true,
  changedAt: true,
  authorUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} as const satisfies Prisma.ProjectChangeHistorySelect;

export const projectInclude = {
  naturalProposer: true,
  proposer: { select: { id: true, fullName: true } },
  observations: { select: projectObservationSelect },
  actorAssignments: { include: { user: true } },
  milestones: {
    include: {
      reportLinks: {
        select: {
          report: { select: { id: true, title: true, status: true } },
        },
      },
    },
  },
  statusHistory: { select: projectStatusHistorySelect },
  changeHistory: { select: projectChangeHistorySelect },
  // Los archivos de una entrega se muestran en su pestaña, no en Anexos.
  attachments: { where: { reportId: null }, select: attachmentSelect },
  reports: { select: reportSelect },
  deliverables: true,
  phaseApprovals: {
    select: { phase: true, approverUserId: true, approvedAt: true },
  },
} as const satisfies Prisma.ProjectInclude;

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;

export type ProjectProposerResponse = {
  type: 'natural_person';
  fullName: string;
  idNumber: string | null;
  email: string;
};

export type ProjectListResponse = {
  id: number;
  name: string;
  status: ProjectStatus;
  phase: ProjectPhase;
  startDate: Date | null;
  location: string | null;
  requiresLegalization: boolean;
  isPrivate: boolean;
  source: ProjectSource;
  sourceDetails: string | null;
  proposer: ProjectProposerResponse | null;
  actors: ProjectActorResponse[];
  /** `false` cuando el espectador solo puede ver la vista pública, sin datos sensibles. */
  canViewSensitiveData: boolean;
};

export type ProjectActorResponse = {
  id: number;
  userId: number;
  role: ActorRole;
  assignedAt: Date;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type MyProjectResponse = {
  id: number;
  name: string;
  status: ProjectStatus;
  startDate: Date | null;
  location: string | null;
  isPrivate: boolean;
  myRole: ActorRole | null;
  isProposer: boolean;
};

export type ProjectDeliverableResponse = {
  id: number;
  projectId: number;
  description: string;
  createdAt: Date;
};

export type ProjectPhaseApprovalResponse = {
  /** Fase que se aprobaría al avanzar; `null` si ya es la fase final. */
  nextPhase: ProjectPhase | null;
  /** Aprobaciones exigidas: proponente (si existe) y evaluadores asignados. */
  required: {
    userId: number;
    fullName: string;
    kind: PhaseApprovalKind;
    /** `null` mientras el aprobador no haya dado su visto bueno. */
    approvedAt: Date | null;
  }[];
};

export type ProjectDetailResponse = ProjectListResponse & {
  description: string;
  context: string;
  startDate: Date | null;
  endDate: Date | null;
  estimatedCost: Prisma.Decimal | null;
  facultyAdvisor: string | null;
  teamRequirements: string | null;
  expectedOutcomes: string | null;
  deliverables: ProjectDeliverableResponse[];
  /** `true` cuando el espectador es el proponente del proyecto. */
  isProposer: boolean;
  /** Visto bueno de fase: quién falta y quién ya aprobó. */
  phaseApprovals: ProjectPhaseApprovalResponse;
  createdAt: Date;
  updatedAt: Date;
  observations: {
    id: number;
    projectId: number;
    content: string;
    createdAt: Date;
    author: {
      id: number;
      fullName: string;
      email: string;
    } | null;
  }[];
  actorAssignments: {
    id: number;
    projectId: number;
    userId: number;
    role: ActorRole;
    assignedAt: Date;
    user: {
      id: number;
      fullName: string;
      email: string;
    };
  }[];
  milestones: {
    id: number;
    projectId: number;
    title: string;
    description: string | null;
    dueDate: Date;
    completed: boolean;
    isMinimum: boolean;
    phase: ProjectPhase | null;
    createdAt: Date;
    reports: { id: number; title: string; status: ReportStatus }[];
  }[];
  statusHistory: {
    id: number;
    projectId: number;
    previousStatus: ProjectStatus | null;
    nextStatus: ProjectStatus;
    description: string | null;
    changedAt: Date;
    author: {
      id: number;
      fullName: string;
      email: string;
    } | null;
  }[];
  changeHistory: {
    id: number;
    projectId: number;
    field: string;
    previousValue: string | null;
    newValue: string | null;
    changedAt: Date;
    author: {
      id: number;
      fullName: string;
      email: string;
    } | null;
  }[];
  attachments: ProjectAttachmentResponse[];
  reports: ProjectReportResponse[];
};

export type ProjectActorAssignmentResponse = {
  id: number;
  projectId: number;
  userId: number;
  role: ActorRole;
  assignedAt: Date;
  project: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type AssignableUserResponse = {
  id: number;
  fullName: string;
  email: string;
  roles: UserRole[];
};

function mapProjectProposer(
  project: Pick<ProjectWithRelations, 'naturalProposer'>,
): ProjectProposerResponse | null {
  if (project.naturalProposer) {
    return {
      type: 'natural_person',
      fullName: project.naturalProposer.fullName,
      idNumber: project.naturalProposer.idNumber,
      email: project.naturalProposer.email,
    };
  }

  return null;
}

function mapAuthor(
  user: { id: number; fullName: string; email: string } | null,
): { id: number; fullName: string; email: string } | null {
  return user
    ? { id: user.id, fullName: user.fullName, email: user.email }
    : null;
}

function mapActorBase(
  assignment: ProjectWithRelations['actorAssignments'][number],
): ProjectActorResponse {
  return {
    id: assignment.id,
    userId: assignment.userId,
    role: assignment.role,
    assignedAt: assignment.assignedAt,
    user: {
      id: assignment.user.id,
      fullName: assignment.user.fullName,
      email: assignment.user.email,
    },
  };
}

function mapObservation(
  observation: ProjectWithRelations['observations'][number],
): ProjectDetailResponse['observations'][number] {
  return {
    id: observation.id,
    projectId: observation.projectId,
    content: observation.content,
    createdAt: observation.createdAt,
    author: mapAuthor(observation.authorUser),
  };
}

function byDateThenId<T extends { id: number }>(
  getTime: (item: T) => number,
  direction: 'asc' | 'desc' = 'asc',
): (left: T, right: T) => number {
  const factor = direction === 'asc' ? 1 : -1;
  return (left, right) =>
    (getTime(left) - getTime(right)) * factor || left.id - right.id;
}

export function mapProjectListResponse(
  project: ProjectWithRelations,
  canViewSensitiveData: boolean,
): ProjectListResponse {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    phase: project.phase,
    startDate: project.startDate,
    location: project.location,
    requiresLegalization: project.requiresLegalization,
    isPrivate: project.isPrivate,
    source: project.source,
    sourceDetails: project.sourceDetails,
    proposer: mapProjectProposer(project),
    // El equipo (nombres y correos) es sensible, así que solo se expone a los
    // miembros mientras el proyecto no sea todavía público.
    actors: canViewSensitiveData
      ? project.actorAssignments.map(mapActorBase)
      : [],
    canViewSensitiveData,
  };
}

function mapPhaseApprovals(
  project: ProjectWithRelations,
  canViewSensitiveData: boolean,
): ProjectPhaseApprovalResponse {
  const nextPhase = nextProjectPhase(project.phase);
  if (!nextPhase || !canViewSensitiveData) {
    return { nextPhase, required: [] };
  }

  const approvals = new Map(
    project.phaseApprovals
      .filter((approval) => approval.phase === nextPhase)
      .map((approval) => [approval.approverUserId, approval.approvedAt]),
  );

  const required = requiredPhaseApprovers({
    proposerUserId: project.proposerUserId,
    proposerFullName: project.proposer?.fullName ?? null,
    evaluators: project.actorAssignments
      .filter((assignment) => assignment.role === ActorRole.evaluator)
      .map((assignment) => ({
        userId: assignment.userId,
        fullName: assignment.user.fullName,
      })),
  });

  return {
    nextPhase,
    required: required.map((approver) => ({
      ...approver,
      approvedAt: approvals.get(approver.userId) ?? null,
    })),
  };
}

export function mapProjectDetailResponse(
  project: ProjectWithRelations,
  canViewSensitiveData: boolean,
  viewer?: AuthenticatedUser,
): ProjectDetailResponse {
  return {
    ...mapProjectListResponse(project, canViewSensitiveData),
    description: project.description,
    context: project.context,
    startDate: project.startDate,
    endDate: project.endDate,
    estimatedCost: project.estimatedCost,
    facultyAdvisor: project.facultyAdvisor,
    teamRequirements: project.teamRequirements,
    expectedOutcomes: project.expectedOutcomes,
    isProposer: viewer != null && project.proposerUserId === viewer.id,
    phaseApprovals: mapPhaseApprovals(project, canViewSensitiveData),
    deliverables: project.deliverables
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((deliverable) => ({
        id: deliverable.id,
        projectId: deliverable.projectId,
        description: deliverable.description,
        createdAt: deliverable.createdAt,
      })),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    // Todo lo que sigue es información interna de colaboración: solo la ven
    // los miembros.
    observations: canViewSensitiveData
      ? project.observations.map(mapObservation)
      : [],
    actorAssignments: canViewSensitiveData
      ? project.actorAssignments.map((assignment) => ({
          ...mapActorBase(assignment),
          projectId: assignment.projectId,
        }))
      : [],
    milestones: canViewSensitiveData
      ? project.milestones
          .slice()
          .sort(byDateThenId((milestone) => milestone.dueDate.getTime()))
          .map((milestone) => ({
            id: milestone.id,
            projectId: milestone.projectId,
            title: milestone.title,
            description: milestone.description,
            dueDate: milestone.dueDate,
            completed: milestone.completed,
            isMinimum: milestone.isMinimum,
            phase: milestone.phase,
            createdAt: milestone.createdAt,
            reports: milestone.reportLinks.map((link) => ({
              id: link.report.id,
              title: link.report.title,
              status: link.report.status,
            })),
          }))
      : [],
    statusHistory: canViewSensitiveData
      ? project.statusHistory
          .slice()
          .sort(byDateThenId((entry) => entry.changedAt.getTime(), 'desc'))
          .map((entry) => ({
            id: entry.id,
            projectId: entry.projectId,
            previousStatus: entry.previousStatus,
            nextStatus: entry.nextStatus,
            description: entry.description,
            changedAt: entry.changedAt,
            author: mapAuthor(entry.authorUser),
          }))
      : [],
    changeHistory: canViewSensitiveData
      ? project.changeHistory
          .slice()
          .sort(byDateThenId((entry) => entry.changedAt.getTime(), 'desc'))
          .map((entry) => ({
            id: entry.id,
            projectId: entry.projectId,
            field: entry.field,
            previousValue: entry.previousValue,
            newValue: entry.newValue,
            changedAt: entry.changedAt,
            author: mapAuthor(entry.authorUser),
          }))
      : [],
    attachments: canViewSensitiveData
      ? project.attachments
          .slice()
          .sort(
            byDateThenId(
              (attachment) => attachment.createdAt.getTime(),
              'desc',
            ),
          )
          .map(mapAttachment)
      : [],
    reports: canViewSensitiveData
      ? project.reports
          .slice()
          .sort(byDateThenId((report) => report.dueDate.getTime()))
          .map(mapReport)
      : [],
  };
}
