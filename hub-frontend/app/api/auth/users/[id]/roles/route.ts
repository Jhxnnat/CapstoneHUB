import { NextResponse } from "next/server";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  const { id } = await params;

  const response = await fetch(`${backendUrl}/auth/users/${id}/roles`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(request.headers.get("authorization")
        ? { Authorization: request.headers.get("authorization")! }
        : {}),
    },
    body: await request.text(),
    cache: "no-store",
  });

  const contentType =
    response.headers.get("content-type") ?? "application/json";
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}