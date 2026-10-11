import { defineConfig, devices } from "@playwright/test";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3001";

/**
 * e2e del frontend: levanta el backend (compilado) y `next start`, y corre los
 * specs en Chromium de escritorio y en un viewport móvil. Requiere que el
 * backend ya esté compilado (`npm run build` en hub-backend) y la base de datos
 * migrada.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command: "npm --prefix ../hub-backend run start:prod",
      url: BACKEND_URL,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: "3001",
        SWAGGER_ENABLED: "false",
      },
      timeout: 120_000,
    },
    {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: "3000",
        BACKEND_URL,
      },
      timeout: 120_000,
    },
  ],
});
