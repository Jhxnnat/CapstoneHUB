import { proxyJson, proxyToBackend } from "@/app/api/proxy";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;

  return proxyJson(request, `/projects/${id}/phase/approvals`, "POST");
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  const { id } = await params;

  return proxyToBackend(request, `/projects/${id}/phase/approvals`, {
    method: "DELETE",
  });
}
