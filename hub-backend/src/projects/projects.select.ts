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
import type { EvaluationGateResponse } from '../evaluations/evaluations.service';

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
  email: string | null;
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
  /** `true` cuando es un privado que el espectador solo ve en vista previa. */
  isPrivatePreview: boolean;
};

export type ProjectViewerInterestResponse = {
  id: number;
  message: string | null;
  createdAt: Date;
};

export type ProjectInterestResponse = {
  id: number;
  projectId: number;
  message: string | null;
  createdAt: Date;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

/** Proyecto interesado tal como se muestra en el perfil del estudiante. */
export type MyProjectInterestResponse = {
  id: number;
  name: string;
  status: ProjectStatus;
  startDate: Date | null;
  location: string | null;
  isPrivate: boolean;
  interestMessage: string | null;
  interestedAt: Date;
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
  facultyAdvisors: string[];
  engineeringArea: string | null;
  externalAdvisorName: string | null;
  externalAdvisorEmail: string | null;
  nit: string | null;
  researchGroup: string | null;
  socialOrganization: string | null;
  socialLocation: string | null;
  projectScope: string | null;
  monetaryResources: string | null;
  monetaryResourcesDescription: string | null;
  teamRequirements: string | null;
  expectedOutcomes: string | null;
  deliverables: ProjectDeliverableResponse[];
  /** `true` cuando el espectador es el proponente del proyecto. */
  isProposer: boolean;
  /** Visto bueno de fase: quién falta y quién ya aprobó. */
  phaseApprovals: ProjectPhaseApprovalResponse;
  /** Estado de evaluación de la fase actual; solo para miembros. */
  evaluationGate: EvaluationGateResponse | null;
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
  /** `true` si el espectador puede crear un interés en este momento. */
  canExpressInterest: boolean;
  /** Interés del espectador, si ya existe. */
  viewerInterest: ProjectViewerInterestResponse | null;
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
  canViewSensitiveData: boolean,
): ProjectProposerResponse | null {
  if (project.naturalProposer) {
    return {
      type: 'natural_person',
      fullName: project.naturalProposer.fullName,
      // La cédula y el correo del proponente son PII: solo se exponen a los
      // miembros. La vista pública conserva únicamente el nombre.
      idNumber: canViewSensitiveData ? project.naturalProposer.idNumber : null,
      email: canViewSensitiveData ? project.naturalProposer.email : null,
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
  const isPrivatePreview = project.isPrivate && !canViewSensitiveData;

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    phase: project.phase,
    startDate: isPrivatePreview ? null : project.startDate,
    location: project.location,
    requiresLegalization: isPrivatePreview
      ? false
      : project.requiresLegalization,
    isPrivate: project.isPrivate,
    source: project.source,
    sourceDetails: isPrivatePreview ? null : project.sourceDetails,
    proposer: isPrivatePreview
      ? null
      : mapProjectProposer(project, canViewSensitiveData),
    // El equipo (nombres y correos) es sensible, así que solo se expone a los
    // miembros mientras el proyecto no sea todavía público.
    actors: canViewSensitiveData
      ? project.actorAssignments.map(mapActorBase)
      : [],
    canViewSensitiveData,
    isPrivatePreview,
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

export type ProjectDetailViewerContext = {
  canExpressInterest?: boolean;
  viewerInterest?: ProjectViewerInterestResponse | null;
};

export function mapProjectDetailResponse(
  project: ProjectWithRelations,
  canViewSensitiveData: boolean,
  viewer?: AuthenticatedUser,
  viewerContext: ProjectDetailViewerContext = {},
): ProjectDetailResponse {
  const privatePreview = project.isPrivate && !canViewSensitiveData;
  const { canExpressInterest = false, viewerInterest = null } = viewerContext;

  return {
    ...mapProjectListResponse(project, canViewSensitiveData),
    description: project.description,
    // La vista previa de un privado solo conserva la información necesaria
    // para que el estudiante decida si le interesa el proyecto.
    context: privatePreview ? '' : project.context,
    startDate: privatePreview ? null : project.startDate,
    endDate: privatePreview ? null : project.endDate,
    estimatedCost: privatePreview ? null : project.estimatedCost,
    facultyAdvisor: privatePreview ? null : project.facultyAdvisor,
    facultyAdvisors: canViewSensitiveData ? project.facultyAdvisors : [],
    engineeringArea: privatePreview ? null : project.engineeringArea,
    externalAdvisorName: canViewSensitiveData
      ? project.externalAdvisorName
      : null,
    externalAdvisorEmail: canViewSensitiveData
      ? project.externalAdvisorEmail
      : null,
    nit: canViewSensitiveData ? project.nit : null,
    researchGroup: privatePreview ? null : project.researchGroup,
    socialOrganization: privatePreview ? null : project.socialOrganization,
    socialLocation: privatePreview ? null : project.socialLocation,
    projectScope: privatePreview ? null : project.projectScope,
    monetaryResources: privatePreview ? null : project.monetaryResources,
    monetaryResourcesDescription: privatePreview
      ? null
      : project.monetaryResourcesDescription,
    teamRequirements: project.teamRequirements,
    expectedOutcomes: project.expectedOutcomes,
    isProposer: viewer != null && project.proposerUserId === viewer.id,
    canExpressInterest,
    viewerInterest,
    phaseApprovals: mapPhaseApprovals(project, canViewSensitiveData),
    evaluationGate: null,
    deliverables: privatePreview
      ? []
      : project.deliverables
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
          .map((attachment) => mapAttachment(attachment))
      : [],
    reports: canViewSensitiveData
      ? project.reports
          .slice()
          .sort(byDateThenId((report) => report.dueDate.getTime()))
          .map(mapReport)
      : [],
  };
}
