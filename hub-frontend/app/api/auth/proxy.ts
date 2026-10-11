import { NextResponse } from "next/server";
import { backendUnavailableResponse } from "../proxy";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "./session";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

async function callBackend(
  request: Request,
  url: string,
  method: string,
): Promise<Response | NextResponse> {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  const token = await getSessionToken();

  try {
    return await fetch(`${backendUrl}${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: method === "GET" ? undefined : await request.text(),
      cache: "no-store",
    });
  } catch {
    return backendUnavailableResponse();
  }
}

function copyResponse(response: Response, body: string): NextResponse {
  const contentType =
    response.headers.get("content-type") ?? "application/json";

  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}

/**
 * Proxy genérico con la cookie de sesión: la reenvía como Bearer, guarda el
 * token renovado (`x-access-token`) y limpia la cookie si el backend responde
 * 401.
 */
export async function proxyRequest(
  request: Request,
  url: string,
  method: "GET" | "POST" | "PATCH",
) {
  const result = await callBackend(request, url, method);

  if (result instanceof NextResponse) {
    return result;
  }

  const body = await result.text();
  const renewedToken = result.headers.get("x-access-token");

  if (renewedToken) {
    await setSessionCookie(renewedToken);
  } else if (result.status === 401) {
    await clearSessionCookie();
  }

  return copyResponse(result, body);
}

/**
 * Login y registro: guardan el token en la cookie httpOnly y devuelven solo el
 * usuario (el token nunca llega al navegador).
 */
export async function proxySessionRequest(request: Request, url: string) {
  const result = await callBackend(request, url, "POST");

  if (result instanceof NextResponse) {
    return result;
  }

  const body = await result.text();

  if (!result.ok) {
    return copyResponse(result, body);
  }

  const data = JSON.parse(body) as {
    user?: unknown;
    accessToken?: string;
  };

  if (data.accessToken) {
    await setSessionCookie(data.accessToken);
  }

  return NextResponse.json({ user: data.user }, { status: result.status });
}
