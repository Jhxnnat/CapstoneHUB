import { expect, test } from "@playwright/test";
import { PASSWORD, registerProposer, uniqueEmail } from "./support";

test("inicia sesión y cierra sesión", async ({ page, request }) => {
  const email = uniqueEmail();
  await registerProposer(request, email);

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/projects/);

  // En móvil el botón vive en el menú hamburguesa.
  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("muestra un error con credenciales inválidas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("no-existe@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("mala-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByText("Invalid credentials")).toBeVisible();
});
