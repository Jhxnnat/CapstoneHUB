import { ProjectObservationItem } from "./schemas";
import { getApiUrl } from "@/lib/api";
import { ensureOk } from "@/lib/http";

export async function createProjectObservation(
  id: string,
  content: string,
): Promise<ProjectObservationItem> {
  const response = await fetch(getApiUrl(`/api/projects/${id}/observations`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  await ensureOk(response, { action: "añadir una observación" });

  return (await response.json()) as ProjectObservationItem;
}
