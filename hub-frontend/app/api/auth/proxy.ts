import { NextResponse } from "next/server";
import { backendUnavailableResponse } from "../proxy";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

export async function proxyRequest(
  request: Request,
  url: string,
  method: "GET" | "POST" | "PATCH",
) {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  let response: Response;

  try {
    response = await fetch(`${backendUrl}${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! }
          : {}),
      },
      body: method === "GET" ? undefined : await request.text(),
      cache: "no-store",
    });
  } catch {
    return backendUnavailableResponse();
  }

  const contentType =
    response.headers.get("content-type") ?? "application/json";
  const body = await response.text();
  // Renovación deslizante: el token reemitido viaja al navegador.
  const renewedToken = response.headers.get("x-access-token");

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      ...(renewedToken ? { "x-access-token": renewedToken } : {}),
    },
  });
}
