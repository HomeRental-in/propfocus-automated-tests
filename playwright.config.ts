import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const defaultTimeoutMs = Number(process.env.DEFAULT_TIMEOUT_MS ?? 30_000);

// Pre-prod gate mode (npm run preprod): 1 retry to absorb dev-env flake
// (retried-passes are reported as "flaky", so nothing is hidden), and the
// ai-search suite is skipped — it depends on a manually refreshed AI_SEARCH_TOKEN
// and takes ~30 LLM round-trips, so it is a scheduled job, not a deploy gate.
const isPreprod = !!process.env.PREPROD;

export default defineConfig({
  testDir: "./tests",
  // false = tests in a file run in order, but a failure does NOT skip the rest
  // (unlike mode:'serial'). Files still run in parallel across workers.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: Number(process.env.RETRIES ?? (process.env.CI ? 2 : isPreprod ? 1 : 0)),
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: {
    timeout: defaultTimeoutMs,
  },
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: defaultTimeoutMs,
    navigationTimeout: defaultTimeoutMs,
    launchOptions: {
      // Human-watchable pacing is opt-in (SLOWMO=500 npm run test:headed);
      // the default 0 keeps the pre-prod gate fast.
      slowMo: Number(process.env.SLOWMO ?? 0),
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/setup/**/*.spec.ts",
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: isPreprod
        ? ["**/setup/**", "**/ai-search/**"]
        : "**/setup/**",
      dependencies: ["setup"],
    }
  ]
});
