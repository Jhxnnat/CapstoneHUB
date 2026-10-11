import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "./auth/session";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

export type ProxyOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: BodyInit | null;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

/**
 * Respuesta uniforme cuando el backend no responde (proceso caído o red
 * inaccesible). Mantiene la misma forma JSON que el backend para que el
 * frontend pueda mostrar un mensaje consistente.
 */
export function backendUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      statusCode: 503,
      error: "Service Unavailable",
      message: "Backend is unavailable",
    },
    { status: 503 },
  );
}

export async function proxyToBackend(
  request: Request,
  path: string,
  options: ProxyOptions = {},
): Promise<NextResponse> {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  const token = await getSessionToken();

  let response: Response;

  try {
    response = await fetch(`${backendUrl}${path}`, {
      method: options.method,
      body: options.body,
      cache: options.cache,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    return backendUnavailableResponse();
  }

  const contentType =
    response.headers.get("content-type") ?? "application/json";
  const body = await response.text();
  const renewedToken = response.headers.get("x-access-token");

  if (renewedToken) {
    await setSessionCookie(renewedToken);
  } else if (response.status === 401) {
    await clearSessionCookie();
  }

  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}

export async function proxyJson(
  request: Request,
  path: string,
  method: "POST" | "PUT" | "PATCH",
): Promise<NextResponse> {
  const body = await request.text();

  return proxyToBackend(request, path, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
}
