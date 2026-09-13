import { proxyRequest } from "./../../../proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return proxyRequest(
    request,
    `/auth/users/${id}/roles`,
    "PATCH",
  );
}