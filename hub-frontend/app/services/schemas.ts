type ProjectNaturalProposer = {
  type: "natural_person";
  fullName: string;
  idNumber: string | null;
  email: string | null;
};

import type { ActorRole, UserRole } from "./roles";

export type ProjectProposer = ProjectNaturalProposer;

export type ProjectSource =
  | "external_entity"
  | "research"
  | "internal_need"
  | "social_impact";

export type ProjectPhase = "semester_1" | "semester_2";

type ProjectActor = {
  id: number;
  projectId: number;
  userId: number;
  role: ActorRole;
  assignedAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type UserSummary = {
  id: number;
  fullName: string;
  email: string;
  roles: UserRole[];
};

export type ProjectObservationItem = {
  id: number;
  projectId: number;
  content: string;
  createdAt: string;
  author: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

export type ProjectCategory = {
  id: number;
  name: string;
  color?: string | null;
};

export type ProjectMilestoneReport = {
  id: number;
  title: string;
  status: ProjectReportStatus;
};

export type ProjectMilestoneItem = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  dueDate: string;
  completed: boolean;
  isMinimum: boolean;
  phase: ProjectPhase | null;
  reports?: ProjectMilestoneReport[];
  createdAt?: string;
};

export type ProjectAttachmentItem = {
  id: number;
  projectId: number;
  reportId?: number | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: {
    id: number;
    fullName: string;
    email: string | null;
  } | null;
};

export type ProjectReportStatus =
  | "pending"
  | "submitted"
  | "accepted"
  | "rejected";

export type ProjectReportContentKind =
  | "text"
  | "link"
  | "image"
  | "video"
  | "file";

export type ProjectReportContentItem = {
  id: number;
  reportId: number;
  kind: ProjectReportContentKind;
  textContent: string | null;
  url: string | null;
  label: string | null;
  createdAt: string;
  attachment: ProjectAttachmentItem | null;
  createdBy: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

export type ProjectReportItem = {
  id: number;
  projectId: number;
  status: ProjectReportStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string | null;
  dueDate: string;
  type: ProjectReportContentKind;
  allowedMimeTypes: string[];
  maxFiles: number | null;
  createdBy: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  reviewedBy: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  milestones?: { id: number; title: string }[];
  contents: ProjectReportContentItem[];
};

export type ProjectStatusHistoryItem = {
  id: number;
  projectId: number;
  previousStatus: string | null;
  nextStatus: string;
  description: string | null;
  changedAt: string;
  author: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

export type ProjectChangeHistoryItem = {
  id: number;
  projectId: number;
  field: string;
  previousValue: string | null;
  newValue: string | null;
  changedAt: string;
  author: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

export type UpdateProjectPayload = {
  name?: string;
  description?: string;
  context?: string;
  location?: string | null;
  source?: ProjectSource;
  startDate?: string | null;
  endDate?: string | null;
  estimatedCost?: number | null;
  requiresLegalization?: boolean;
  isPrivate?: boolean;
  facultyAdvisor?: string | null;
  teamRequirements?: string | null;
  expectedOutcomes?: string | null;
  deliverables?: string[];
};

export type ProjectItem = {
  id: string;
  name: string;
  location?: string;
  context?: string;
  status: string;
  startDate: string | null;
  requiresLegalization?: boolean;
  isPrivate?: boolean;
  source?: ProjectSource;
  proposer?: ProjectProposer;
  actors: ProjectActor[];
  estimatedCost?: string | null;
  canViewSensitiveData?: boolean;
  /** `true` cuando es un privado visible solo como vista previa. */
  isPrivatePreview?: boolean;
};

export type ProjectViewerInterest = {
  id: number;
  message: string | null;
  createdAt: string;
};

export type ProjectInterestItem = {
  id: number;
  projectId: number;
  message: string | null;
  createdAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type MyProject = {
  id: number;
  name: string;
  status: string;
  startDate: string | null;
  location: string | null;
  isPrivate?: boolean;
  myRole: ActorRole | null;
  isProposer: boolean;
};

/** Proyecto interesado tal como llega al perfil del estudiante. */
export type MyProjectInterest = {
  id: number;
  name: string;
  status: string;
  startDate: string | null;
  location: string | null;
  isPrivate: boolean;
  interestMessage: string | null;
  interestedAt: string;
};

export type ProjectDeliverableItem = {
  id: number;
  projectId: number;
  description: string;
  createdAt: string;
};

export type ProjectPhaseApprovalItem = {
  userId: number;
  fullName: string;
  kind: "proposer" | "evaluator";
  approvedAt: string | null;
};

export type ProjectPhaseApprovals = {
  nextPhase: ProjectPhase | null;
  required: ProjectPhaseApprovalItem[];
};

export type ProjectEvaluationGate = {
  phase: ProjectPhase;
  completed: boolean;
  missingEvaluators: { userId: number; fullName: string }[];
};

export type ProjectDetails = {
  id: number;
  name: string;
  description: string;
  context: string;
  location?: string | null;
  status: string;
  phase?: ProjectPhase;
  requiresLegalization?: boolean;
  isPrivate?: boolean;
  canViewSensitiveData?: boolean;
  /** `true` cuando es un privado visible solo como vista previa. */
  isPrivatePreview?: boolean;
  /** `true` si el usuario actual puede expresar interés ahora. */
  canExpressInterest?: boolean;
  /** Interés del usuario actual, si ya existe. */
  viewerInterest?: ProjectViewerInterest | null;
  /** `true` cuando el usuario actual propuso el proyecto. */
  isProposer?: boolean;
  /** Visto bueno de fase: quién falta y quién ya aprobó. */
  phaseApprovals?: ProjectPhaseApprovals;
  /** Estado de evaluación de la fase actual, sin notas. */
  evaluationGate?: ProjectEvaluationGate | null;
  source?: ProjectSource;
  proposer?: ProjectProposer;
  startDate: string | null;
  endDate: string | null;
  estimatedCost: string | null;
  facultyAdvisor?: string | null;
  facultyAdvisors?: string[];
  engineeringArea?: string | null;
  externalAdvisorName?: string | null;
  externalAdvisorEmail?: string | null;
  nit?: string | null;
  researchGroup?: string | null;
  socialOrganization?: string | null;
  socialLocation?: string | null;
  projectScope?: string | null;
  monetaryResources?: string | null;
  monetaryResourcesDescription?: string | null;
  teamRequirements?: string | null;
  expectedOutcomes?: string | null;
  deliverables?: ProjectDeliverableItem[];
  createdAt: string;
  updatedAt: string;
  observations: ProjectObservationItem[];
  actorAssignments: ProjectActor[];
  // Opcionales: el backend aún no los expone en todos los ambientes.
  // Cuando existan, se muestran automáticamente en la pestaña "Categorías".
  categories?: ProjectCategory[];
  milestones?: ProjectMilestoneItem[];
  statusHistory?: ProjectStatusHistoryItem[];
  changeHistory?: ProjectChangeHistoryItem[];
  attachments?: ProjectAttachmentItem[];
  reports?: ProjectReportItem[];
};
