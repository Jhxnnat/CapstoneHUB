import {
  ProjectDetails,
  ProjectItem,
  ProjectSource,
  UserSummary,
  MyProject,
  UpdateProjectPayload,
} from "./schemas";
import { getApiUrl } from "@/lib/api";
import {
  apiErrorMessage,
  ensureOk,
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
  ncedua?: string;
  facultyAdvisor?: string;
  teamRequirements?: string;
  expectedOutcomes?: string;
  deliverables?: string[];
  submissionConsentAt: string;
};

export async function getProjects(): Promise<{
  projects: ProjectItem[];
  status?: number;
  error?: string;
}> {
  try {
    const response = await fetch(getApiUrl("/api/projects"), {
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
      error:
        "Unable to reach the backend projects endpoint: " + err,
    };
  }
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

export async function updateProjectStatus(
  id: string,
  status: string,
  description?: string,
): Promise<ProjectDetails> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/status`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, description }),
  });

  await ensureOk(response, { action: "cambiar el estado del proyecto" });

  return (await response.json()) as ProjectDetails;
}

export async function advanceProjectPhase(
  id: string,
): Promise<ProjectDetails> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/phase/advance`), {
    method: "POST",
  });

  await ensureOk(response, { action: "avanzar la fase del proyecto" });

  return (await response.json()) as ProjectDetails;
}

export async function approveProjectPhase(
  id: string,
): Promise<ProjectDetails> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/phase/approvals`),
    {
      method: "POST",
    },
  );

  await ensureOk(response, { action: "dar el visto bueno de fase" });

  return (await response.json()) as ProjectDetails;
}

export async function revokeProjectPhaseApproval(
  id: string,
): Promise<ProjectDetails> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/phase/approvals`),
    {
      method: "DELETE",
    },
  );

  await ensureOk(response, { action: "retirar el visto bueno de fase" });

  return (await response.json()) as ProjectDetails;
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<ProjectDetails> {
  const response = await fetch(getApiUrl(`/api/projects/${id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response, {
    action: "editar el proyecto",
    conflictMessage: PROJECT_EDIT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectDetails;
}

export async function createProject(
  payload: CreateProjectPayload,
): Promise<ProjectDetails> {
  const res = await fetch(getApiUrl("/api/projects"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(res, { action: "proponer un proyecto" });

  return (await res.json()) as ProjectDetails;
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

export async function addProjectActorAssignment(
  projectId: number,
  payload: { userId: number; role: string },
): Promise<{
  id: number;
  projectId: number;
  userId: number;
  role: string;
  assignedAt: string;
  project: { id: number; name: string };
  user: { id: number; fullName: string; email: string };
}> {
  const response = await fetch(getApiUrl(`/api/projects/${projectId}/actors`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response, { action: "asignar actores al proyecto" });

  return (await response.json()) as {
    id: number;
    projectId: number;
    userId: number;
    role: string;
    assignedAt: string;
    project: { id: number; name: string };
    user: { id: number; fullName: string; email: string };
  };
}
