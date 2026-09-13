import { NextResponse } from "next/server";

const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

export async function GET(request: Request) {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }



  const response = await fetch(`${backendUrl}/auth/users`, {
    headers: {
      ...(request.headers.get("authorization")
        ? { Authorization: request.headers.get("authorization")! }
        : {}),
    },
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") ?? "application/json";
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}

export async function POST(request: Request) {
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not set" },
      { status: 500 },
    );
  }

  const response = await fetch(`${backendUrl}/auth/users`, {
    method: "POST",
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