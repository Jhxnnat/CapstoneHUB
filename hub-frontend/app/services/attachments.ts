import { ProjectAttachmentItem } from "./schemas";
import { getApiUrl } from "@/lib/api";
import { ensureOk } from "@/lib/http";

export async function getProjectAttachments(
  id: string,
): Promise<ProjectAttachmentItem[]> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/attachments`), {
    cache: "no-store",
  });

  await ensureOk(response, { action: "consultar el anexo" });

  return (await response.json()) as ProjectAttachmentItem[];
}

export async function uploadProjectAttachment(
  id: string,
  file: File,
  reportId?: number,
): Promise<ProjectAttachmentItem> {
  const formData = new FormData();
  formData.append("file", file);

  if (reportId !== undefined) {
    formData.append("reportId", String(reportId));
  }

  const response = await fetch(getApiUrl(`/api/projects/${id}/attachments`), {
    method: "POST",
    body: formData,
  });

  await ensureOk(response, { action: "subir el anexo" });

  return (await response.json()) as ProjectAttachmentItem;
}

export async function deleteProjectAttachment(
  id: string,
  attachmentId: number,
): Promise<void> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/attachments/${attachmentId}`),
    {
      method: "DELETE",
    },
  );

  await ensureOk(response, { action: "eliminar el anexo" });
}

export async function downloadProjectAttachment(
  id: string,
  attachmentId: number,
  fileName: string,
): Promise<void> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/attachments/${attachmentId}/download`),
    {
      cache: "no-store",
    },
  );

  await ensureOk(response, { action: "descargar el anexo" });

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
