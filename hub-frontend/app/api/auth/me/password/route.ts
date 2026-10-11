import { proxyRequest } from "../../proxy";

export async function PATCH(request: Request) {
  return proxyRequest(request, "/auth/me/password", "PATCH");
}
