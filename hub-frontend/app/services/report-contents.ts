import { ProjectReportContentItem } from "./schemas";
import { REPORT_CONFLICT_MESSAGE } from "./reports";
import { getApiUrl } from "@/lib/api";
import { ensureOk } from "@/lib/http";

export type CreateReportContentPayload =
  | { kind: "text"; textContent: string }
  | { kind: "link"; url: string; label?: string | null };

export type UpdateReportContentPayload = {
  textContent?: string;
  url?: string;
  label?: string | null;
};

export type ReportContentFileMetadata = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function createReportContent(
  id: string,
  reportId: number,
  payload: CreateReportContentPayload,
): Promise<ProjectReportContentItem> {
  const response = await fetch(
    getApiUrl(`/api/projects/${id}/reports/${reportId}/contents`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  await ensureOk(response, {
    action: "agregar el contenido de la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportContentItem;
}

export type ReportFileUploadTarget = {
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  expiresInSeconds: number;
};

export async function presignReportContentFile(
  id: string,
  reportId: number,
  metadata: ReportContentFileMetadata,
): Promise<ReportFileUploadTarget> {
  const response = await fetch(
    getApiUrl(
      `/api/projects/${id}/reports/${reportId}/contents/files/presign`,
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
  );

  await ensureOk(response, {
    action: "preparar la subida del contenido de la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ReportFileUploadTarget;
}

/**
 * Sube el archivo directamente al almacenamiento con la URL prefirmada. Usa
 * XMLHttpRequest porque `fetch` no expone el progreso de subida.
 */
export function uploadFileToStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`No se pudo subir el archivo (HTTP ${request.status}).`));
    };

    request.onerror = () =>
      reject(
        new Error(
          "No se pudo conectar con el almacenamiento para subir el archivo.",
        ),
      );
    request.onabort = () => reject(new Error("La subida fue cancelada."));

    request.send(file);
  });
}

export async function confirmReportContentFile(
  id: string,
  reportId: number,
  metadata: ReportContentFileMetadata & { storageKey: string },
): Promise<ProjectReportContentItem> {
  const response = await fetch(
    getApiUrl(
      `/api/projects/${id}/reports/${reportId}/contents/files/confirm`,
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
  );

  await ensureOk(response, {
    action: "confirmar la subida del contenido de la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportContentItem;
}

export async function updateReportContent(
  id: string,
  reportId: number,
  contentId: number,
  payload: UpdateReportContentPayload,
): Promise<ProjectReportContentItem> {
  const response = await fetch(
    getApiUrl(
      `/api/projects/${id}/reports/${reportId}/contents/${contentId}`,
    ),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  await ensureOk(response, {
    action: "editar el contenido de la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });

  return (await response.json()) as ProjectReportContentItem;
}

export async function deleteReportContent(
  id: string,
  reportId: number,
  contentId: number,
): Promise<void> {
  const response = await fetch(
    getApiUrl(
      `/api/projects/${id}/reports/${reportId}/contents/${contentId}`,
    ),
    {
      method: "DELETE",
    },
  );

  await ensureOk(response, {
    action: "eliminar el contenido de la entrega",
    conflictMessage: REPORT_CONFLICT_MESSAGE,
  });
}

/**
 * URL del stream inline (imagen/video/archivo). La cookie httpOnly de sesión
 * viaja sola en la petición same-origin, así que no hace falta token en query.
 */
export function getReportContentStreamUrl(
  id: string,
  reportId: number,
  contentId: number,
): string {
  return getApiUrl(
    `/api/projects/${id}/reports/${reportId}/contents/${contentId}/stream`,
  );
}
