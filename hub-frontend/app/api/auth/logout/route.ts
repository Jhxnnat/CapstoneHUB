import { NextResponse } from "next/server";
import { clearSessionCookie } from "../session";

export async function POST() {
  await clearSessionCookie();

  return new NextResponse(null, { status: 204 });
}
