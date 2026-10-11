import { NextResponse } from "next/server";
import { backendUnavailableResponse } from "@/app/api/proxy";
import { getSessionToken } from "@/app/api/auth/session";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

type Params = Promise<{ id: string; reportId: string; contentId: string }>;

/**
 * Proxy de streaming para imágenes, videos y archivos. Reenvía la cabecera
 * `Range` y devuelve el cuerpo sin bufferizar, de modo que `<video>` pueda
 * buscar sin descargar el archivo completo. La cookie httpOnly de sesión se
 * reenvía como `Authorization`.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { id, reportId, contentId } = await params;

  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  const sessionToken = await getSessionToken();
  const range = request.headers.get("range");

  let upstream: Response;

  try {
    upstream = await fetch(
      `${backendUrl}/projects/${id}/reports/${reportId}/contents/${contentId}/stream`,
      {
        headers: {
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          ...(range ? { Range: range } : {}),
        },
        cache: "no-store",
      },
    );
  } catch {
    return backendUnavailableResponse();
  }

  const headers = new Headers();

  for (const header of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "content-disposition",
  ]) {
    const value = upstream.headers.get(header);

    if (value) {
      headers.set(header, value);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
