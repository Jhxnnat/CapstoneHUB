import type { APIRequestContext } from "@playwright/test";

export const BACKEND_URL =
  process.env.E2E_BACKEND_URL ?? "http://localhost:3001";

export const PASSWORD = "password123";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Registra un proponente directo contra el backend y devuelve su sesión. */
export async function registerProposer(
  request: APIRequestContext,
  email: string,
) {
  const response = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { fullName: "Proponente E2E", email, password: PASSWORD },
  });

  if (!response.ok()) {
    throw new Error(
      `No se pudo registrar ${email}: ${response.status()} ${await response.text()}`,
    );
  }

  return (await response.json()) as {
    user: { id: number; email: string };
    accessToken: string;
  };
}
