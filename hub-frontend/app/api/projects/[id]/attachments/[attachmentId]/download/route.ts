import { NextResponse } from "next/server";
import { backendUnavailableResponse } from "@/app/api/proxy";
import { getSessionToken } from "@/app/api/auth/session";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await params;

  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  const sessionToken = await getSessionToken();

  let response: Response;

  try {
    response = await fetch(
      `${backendUrl}/projects/${id}/attachments/${attachmentId}/download`,
      {
        headers: {
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        cache: "no-store",
      },
    );
  } catch {
    return backendUnavailableResponse();
  }

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");
  const contentLength = response.headers.get("content-length");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  const body = await response.arrayBuffer();

  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}
