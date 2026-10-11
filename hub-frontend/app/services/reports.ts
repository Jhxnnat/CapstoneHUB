import { ProjectReportContentKind, ProjectReportItem } from "./schemas";
import { getApiUrl } from "@/lib/api";
import { ensureOk } from "@/lib/http";

export const REPORT_CONFLICT_MESSAGE =
  "La entrega no está en un estado válido para esta acción.";

export type CreateProjectReportPayload = {
  title: string;
  description?: string | null;
  dueDate: string;
  type: ProjectReportContentKind;
  allowedMimeTypes?: string[];
  maxFiles?: number;
};

export type UpdateProjectReportPayload = Partial<CreateProjectReportPayload>;

export async function getProjectReports(
  id: string,
): Promise<ProjectReportItem[]> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/reports`), {
    cache: "no-store",
  });

  await ensureOk(response, {
    action: "consultar la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportItem[];
}

export async function createProjectReport(
  id: string,
  payload: CreateProjectReportPayload,
): Promise<ProjectReportItem> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/reports`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response, {
    action: "crear la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportItem;
}

export async function updateProjectReport(
  id: string,
  reportId: number,
  payload: UpdateProjectReportPayload,
): Promise<ProjectReportItem> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/reports/${reportId}`),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  await ensureOk(response, {
    action: "editar la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportItem;
}

export async function deleteProjectReport(
  id: string,
  reportId: number,
): Promise<void> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/reports/${reportId}`),
    {
      method: "DELETE",
    },
  );

  await ensureOk(response, {
    action: "eliminar la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });
}

export async function submitProjectReport(
  id: string,
  reportId: number,
): Promise<ProjectReportItem> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/reports/${reportId}/submit`),
    {
      method: "POST",
      headers: {
      },
    },
  );

  await ensureOk(response, {
    action: "enviar la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportItem;
}

export async function reviewProjectReport(
  id: string,
  reportId: number,
  decision: "accepted" | "rejected",
  comment?: string,
): Promise<ProjectReportItem> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/reports/${reportId}/review`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision, comment }),
    },
  );

  await ensureOk(response, {
    action: "revisar la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportItem;
}
