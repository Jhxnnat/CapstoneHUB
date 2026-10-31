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
  /** Reenvía la respuesta sin bufferizar (streaming de archivos) y `Range`. */
  stream?: boolean;
  /** Stream de subida del cuerpo de la petición (sin bufferizar). */
  duplex?: "half";
};

/** Tope de cuerpo JSON: protege al BFF de cuerpos gigantes antes de reenviar. */
const MAX_JSON_BODY_BYTES = 1_000_000;

const STREAM_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "content-disposition",
] as const;

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

function relayStreamHeaders(source: Headers): Headers {
  const headers = new Headers();

  for (const name of STREAM_HEADERS) {
    const value = source.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

/**
 * Rechaza mutaciones cross-origin: si el navegador envía `Origin` y no coincide
 * con el `Host`, se trata de una petición de un sitio distinto (CSRF). Las
 * peticiones sin `Origin` (p. ej. curl) se dejan pasar y quedan cubiertas por
 * la cookie `SameSite=Lax` y la autenticación del backend.
 */
export function isCrossOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return false;
  }

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/**
 * Aplica el flujo de sesión sobre la respuesta del backend: guarda el token
 * renovado (`x-access-token`) y limpia la cookie si responde 401.
 */
async function applySessionFlow(response: Response): Promise<void> {
  const renewedToken = response.headers.get("x-access-token");

  if (renewedToken) {
    await setSessionCookie(renewedToken);
  } else if (response.status === 401) {
    await clearSessionCookie();
  }
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

  const method = options.method ?? "GET";

  if (method !== "GET" && isCrossOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  const token = await getSessionToken();
  const range = options.stream ? request.headers.get("range") : undefined;

  let response: Response;

  try {
    const init: RequestInit & { duplex?: "half" } = {
      method: options.method,
      body: options.body,
      cache: options.cache,
      duplex: options.duplex,
      headers: {
        ...options.headers,
        ...(range ? { Range: range } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    response = await fetch(`${backendUrl}${path}`, init);
  } catch {
    return backendUnavailableResponse();
  }

  await applySessionFlow(response);

  if (options.stream) {
    return new NextResponse(response.body, {
      status: response.status,
      headers: relayStreamHeaders(response.headers),
    });
  }

  const contentType =
    response.headers.get("content-type") ?? "application/json";
  const body = await response.text();

  // Los estados 204/205/304 no admiten cuerpo; `NextResponse` lanza si se
  // construye con uno (por ejemplo al reenviar un DELETE 204 del backend).
  if (
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304
  ) {
    return new NextResponse(null, { status: response.status });
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
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_JSON_BODY_BYTES) {
    return NextResponse.json(
      { statusCode: 413, error: "Payload Too Large", message: "Request body is too large" },
      { status: 413 },
    );
  }

  const body = await request.text();

  if (body.length > MAX_JSON_BODY_BYTES) {
    return NextResponse.json(
      { statusCode: 413, error: "Payload Too Large", message: "Request body is too large" },
      { status: 413 },
    );
  }

  return proxyToBackend(request, path, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
}
