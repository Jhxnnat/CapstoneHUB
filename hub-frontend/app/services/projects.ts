import {
  ProjectDetails,
  ProjectInterestItem,
  ProjectItem,
  ProjectSource,
  UserSummary,
  MyProject,
  MyProjectInterest,
  UpdateProjectPayload,
} from "./schemas";
import { getApiUrl } from "@/lib/api";
import {
  apiErrorMessage,
  apiRequest,
  apiRequestVoid,
  notifyUnauthorized,
} from "@/lib/http";

const PROJECT_EDIT_CONFLICT_MESSAGE =
  "El proyecto está finalizado o rechazado y ya no se puede editar.";

export type CreateProjectPayload = {
  name: string;
  namep: string;
  correo: string;
  description: string;
  context: string;
  requiresLegalization?: boolean;
  isPrivate?: boolean;
  source?: ProjectSource;
  sourceDetails?: string;
  engineeringArea?: string;
  externalAdvisorName?: string;
  externalAdvisorEmail?: string;
  nit?: string;
  researchGroup?: string;
  socialOrganization?: string;
  socialLocation?: string;
  projectScope?: string;
  monetaryResources?: string;
  monetaryResourcesDescription?: string;
  facultyAdvisors?: string[];
  ncedua?: string;
  facultyAdvisor?: string;
  teamRequirements?: string;
  expectedOutcomes?: string;
  deliverables?: string[];
  submissionConsentAt: string;
};

export type ProjectListQuery = {
  search?: string;
  status?: string[];
  proposer?: string[];
  source?: string[];
  requiresLegalization?: boolean;
  year?: number[];
  withoutYear?: boolean;
  assignedToMe?: boolean;
  proposedByMe?: boolean;
  hasTeam?: boolean;
  isPrivate?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
};

function buildProjectsQuery(query: ProjectListQuery): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  query.status?.forEach((value) => params.append("status", value));
  query.proposer?.forEach((value) => params.append("proposer", value));
  query.source?.forEach((value) => params.append("source", value));
  query.year?.forEach((value) => params.append("year", String(value)));

  if (query.requiresLegalization !== undefined) {
    params.set("requiresLegalization", String(query.requiresLegalization));
  }

  if (query.withoutYear) {
    params.set("withoutYear", "true");
  }

  if (query.assignedToMe) {
    params.set("assignedToMe", "true");
  }

  if (query.proposedByMe) {
    params.set("proposedByMe", "true");
  }

  if (query.hasTeam) {
    params.set("hasTeam", "true");
  }

  if (query.isPrivate) {
    params.set("isPrivate", "true");
  }

  if (query.sort && query.sort !== "relevance") {
    params.set("sort", query.sort);
  }

  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  return params.toString();
}

export async function getProjects(
  query: ProjectListQuery = {},
): Promise<{
  projects: ProjectItem[];
  status?: number;
  error?: string;
}> {
  try {
    const queryString = buildProjectsQuery(query);
    const path = queryString
      ? `/api/projects?${queryString}`
      : "/api/projects";
    const response = await fetch(getApiUrl(path), {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        notifyUnauthorized();
      }

      return {
        projects: [],
        status: response.status,
        error: await apiErrorMessage(response),
      };
    }

    const data = (await response.json()) as ProjectItem[];
    return {
      projects: Array.isArray(data) ? data : [],
    };
  } catch (err) {
    return {
      projects: [],
      error: "Unable to reach the backend projects endpoint: " + err,
    };
  }
}

export async function getMyProjects(): Promise<{
  projects: MyProject[];
  error?: string;
}> {
  try {
    const response = await fetch(getApiUrl("/api/projects/mine"), {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        notifyUnauthorized();
      }

      return {
        projects: [],
        error: await apiErrorMessage(response),
      };
    }

    const data = (await response.json()) as MyProject[];
    return {
      projects: Array.isArray(data) ? data : [],
    };
  } catch (err) {
    return {
      projects: [],
      error: "Unable to reach the backend projects endpoint: " + err,
    };
  }
}

export async function getMyProjectInterests(): Promise<{
  projects: MyProjectInterest[];
  error?: string;
}> {
  try {
    const response = await fetch(getApiUrl("/api/projects/mine/interests"), {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        notifyUnauthorized();
      }

      return {
        projects: [],
        error: await apiErrorMessage(response),
      };
    }

    const data = (await response.json()) as MyProjectInterest[];
    return {
      projects: Array.isArray(data) ? data : [],
    };
  } catch (err) {
    return {
      projects: [],
      error: "Unable to reach the backend projects endpoint: " + err,
    };
  }
}

export async function getProjectInterests(projectId: number): Promise<{
  interests: ProjectInterestItem[];
  error?: string;
}> {
  try {
    const response = await fetch(
      getApiUrl(`/api/projects/${projectId}/interests`),
      { cache: "no-store" },
    );

    if (!response.ok) {
      if (response.status === 401) {
        notifyUnauthorized();
      }

      return {
        interests: [],
        error: await apiErrorMessage(response),
      };
    }

    const data = (await response.json()) as ProjectInterestItem[];
    return {
      interests: Array.isArray(data) ? data : [],
    };
  } catch (err) {
    return {
      interests: [],
      error: "Unable to reach the backend projects endpoint: " + err,
    };
  }
}

export function expressProjectInterest(
  projectId: number,
  message?: string,
): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(`/api/projects/${projectId}/interests`, {
    method: "POST",
    body: { message: message?.trim() || undefined },
    action: "expresar interés en el proyecto",
    conflictMessage:
      "No se pudo registrar el interés. Puede que ya estés interesado o que el proyecto ya no esté aprobado.",
  });
}

export function withdrawProjectInterest(projectId: number): Promise<void> {
  return apiRequestVoid(`/api/projects/${projectId}/interests/me`, {
    method: "DELETE",
    action: "retirar el interés del proyecto",
  });
}

export function dismissProjectInterest(
  projectId: number,
  interestId: number,
): Promise<void> {
  return apiRequestVoid(
    `/api/projects/${projectId}/interests/${interestId}`,
    {
      method: "DELETE",
      action: "descartar el interés del estudiante",
    },
  );
}

export async function getProjectById(id: string): Promise<{
  project?: ProjectDetails;
  status?: number;
  error?: string;
}> {
  try {
    const response = await fetch(getApiUrl(`/api/projects/${id}`), {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        notifyUnauthorized();
      }

      return {
        status: response.status,
        error: await apiErrorMessage(response),
      };
    }

    const data = (await response.json()) as ProjectDetails;
    return {
      project: data,
    };
  } catch (err) {
    return {
      error: "Unable to reach the backend project endpoint: " + err,
    };
  }
}

export function updateProjectStatus(
  id: string,
  status: string,
  description?: string,
): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(`/api/projects/${id}/status`, {
    method: "PATCH",
    body: { status, description },
    action: "cambiar el estado del proyecto",
  });
}

export function advanceProjectPhase(id: string): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(`/api/projects/${id}/phase/advance`, {
    method: "POST",
    action: "avanzar la fase del proyecto",
  });
}

export function approveProjectPhase(id: string): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(`/api/projects/${id}/phase/approvals`, {
    method: "POST",
    action: "dar el visto bueno de fase",
  });
}

export function revokeProjectPhaseApproval(id: string): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(`/api/projects/${id}/phase/approvals`, {
    method: "DELETE",
    action: "retirar el visto bueno de fase",
  });
}

export function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>(`/api/projects/${id}`, {
    method: "PUT",
    body: payload,
    action: "editar el proyecto",
    conflictMessage: PROJECT_EDIT_CONFLICT_MESSAGE,
  });
}

export function createProject(payload: CreateProjectPayload): Promise<ProjectDetails> {
  return apiRequest<ProjectDetails>("/api/projects", {
    method: "POST",
    body: payload,
    action: "proponer un proyecto",
  });
}

export async function getAssignableUsers(
  projectId: number,
): Promise<{ users: UserSummary[]; error?: string }> {
  try {
    const response = await fetch(
      getApiUrl(`/api/projects/${projectId}/assignable-users`),
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        users: [],
        error: await apiErrorMessage(response),
      };
    }

    const data = (await response.json()) as UserSummary[];
    return {
      users: Array.isArray(data) ? data : [],
    };
  } catch (err) {
    return {
      users: [],
      error: "Unable to reach the backend users endpoint: " + err,
    };
  }
}

type ProjectActorAssignmentResult = {
  id: number;
  projectId: number;
  userId: number;
  role: string;
  assignedAt: string;
  project: { id: number; name: string };
  user: { id: number; fullName: string; email: string };
};

export function addProjectActorAssignment(
  projectId: number,
  payload: { userId: number; role: string },
): Promise<ProjectActorAssignmentResult> {
  return apiRequest<ProjectActorAssignmentResult>(
    `/api/projects/${projectId}/actors`,
    {
      method: "POST",
      body: payload,
      action: "asignar actores al proyecto",
    },
  );
}
