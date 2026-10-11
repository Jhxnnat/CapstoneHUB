import { ProjectMilestoneItem, ProjectPhase } from "./schemas";
import { getApiUrl } from "@/lib/api";
import { ensureOk } from "@/lib/http";

export type CreateProjectMilestonePayload = {
  title: string;
  description?: string | null;
  dueDate: string;
  completed?: boolean;
  isMinimum?: boolean;
  phase?: ProjectPhase;
  reportIds?: number[];
};

export type UpdateProjectMilestonePayload = Partial<
  CreateProjectMilestonePayload
>;

export async function getProjectMilestones(
  id: string,
): Promise<ProjectMilestoneItem[]> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/milestones`), {
    cache: "no-store",
  });

  await ensureOk(response, { action: "consultar los hitos del proyecto" });

  return (await response.json()) as ProjectMilestoneItem[];
}

export async function createProjectMilestone(
  id: string,
  payload: CreateProjectMilestonePayload,
): Promise<ProjectMilestoneItem> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/milestones`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response, { action: "crear un hito" });

  return (await response.json()) as ProjectMilestoneItem;
}

export async function updateProjectMilestone(
  id: string,
  milestoneId: number,
  payload: UpdateProjectMilestonePayload,
): Promise<ProjectMilestoneItem> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/milestones/${milestoneId}`),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  await ensureOk(response, { action: "editar un hito" });

  return (await response.json()) as ProjectMilestoneItem;
}

export async function deleteProjectMilestone(
  id: string,
  milestoneId: number,
): Promise<void> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/milestones/${milestoneId}`),
    {
      method: "DELETE",
    },
  );

  await ensureOk(response, { action: "eliminar un hito" });
}
