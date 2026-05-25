import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const defaultTimeoutMs = Number(process.env.DEFAULT_TIMEOUT_MS ?? 30_000);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: {
    timeout: defaultTimeoutMs,
  },
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: defaultTimeoutMs,
    navigationTimeout: defaultTimeoutMs,
      launchOptions: {
        slowMo: 500
      }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
