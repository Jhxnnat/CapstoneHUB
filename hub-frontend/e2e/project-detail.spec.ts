import { expect, test } from "@playwright/test";
import { BACKEND_URL, PASSWORD, registerProposer, uniqueEmail } from "./support";

test("muestra las pestañas del detalle sin desborde horizontal", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("owner");
  const { accessToken } = await registerProposer(request, email);

  const created = await request.post(`${BACKEND_URL}/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      name: "Proyecto E2E",
      description: "Descripción del proyecto",
      context: "Contexto del proyecto",
      namep: "Proponente E2E",
      correo: email,
      isPrivate: true,
      submissionConsentAt: new Date().toISOString(),
    },
  });
  const { id } = (await created.json()) as { id: number };
  expect(id).toBeGreaterThan(0);

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/projects/);

  await page.goto(`/projects/${id}`);

  // El proponente es miembro: ve las 8 pestañas.
  await expect(page.locator('[data-slot="tabs-trigger"]')).toHaveCount(8);

  // La lista no debe generar scroll horizontal (fix #80).
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
