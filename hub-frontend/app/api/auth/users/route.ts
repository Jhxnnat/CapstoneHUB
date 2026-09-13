import { proxyRequest } from "../../auth/proxy";

export async function GET(request: Request) {
  return proxyRequest(request, "/auth/users", "GET");
}

export async function POST(request: Request) {
  return proxyRequest(request, "/auth/users", "POST");
}