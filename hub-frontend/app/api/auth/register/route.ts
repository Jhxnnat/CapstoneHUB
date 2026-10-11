import { proxySessionRequest } from "../proxy";

export async function POST(request: Request) {
  return proxySessionRequest(request, "/auth/register");
}
