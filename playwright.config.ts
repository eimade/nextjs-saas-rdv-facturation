import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:13000";

/**
 * E2E sur l'application buildée (npm run build) avec la base de démo (npm run db:setup).
 * Si un serveur tourne déjà sur 13000, il est réutilisé.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "fr-FR" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /booking\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
