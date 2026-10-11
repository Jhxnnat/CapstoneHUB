import { proxyRequest } from "../proxy";

export async function GET(request: Request) {
  return proxyRequest(request, "/auth/me", "GET");
}
