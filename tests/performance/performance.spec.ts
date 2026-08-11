import { test, expect } from "@playwright/test";
import { loginBroker, getOverviewStats, getMicrosites, getRecentActivity } from "../../utils/dashboardApi";
import { DEFAULT_PHONE } from "../../utils/buyerLinks";
import { loginViaUI, gotoTab } from "../../utils/uiLogin";

/**
 * Performance guards for the dashboard's known hot paths.
 *
 * Grounded in observed incidents: /dashboard/overview-stats saturates the DB
 * pool under concurrency (12–23s, 5xx at ~20 concurrent) and /dashboard/microsites
 * pagination has returned 500s. These tests assert latency budgets, that
 * concurrency does NOT produce 5xx, and that every pagination page is healthy.
 *
 * Thresholds are env-tunable so they can be tightened per environment:
 *   PERF_API_MAX_MS   (default 8000)  single-request budget
 *   PERF_CONCURRENCY  (default 10)    concurrent overview-stats requests
 *   PERF_PAGE_MAX_MS  (default 15000) full page-load budget
 *   PERF_PAGES        (default 5)     pagination pages to sweep
 */

const API_MAX_MS = Number(process.env.PERF_API_MAX_MS ?? 8000);
const CONCURRENCY = Number(process.env.PERF_CONCURRENCY ?? 10);
const PAGE_MAX_MS = Number(process.env.PERF_PAGE_MAX_MS ?? 15000);
const PAGES = Number(process.env.PERF_PAGES ?? 5);
const PAGE_LIMIT = 20;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = Date.now();
  const value = await fn();
  return { ms: Date.now() - start, value };
}

test.describe("Performance — API latency & resilience", () => {
  test.setTimeout(180_000);
  let token: string;

  test.beforeAll(async ({ playwright }) => {
    const rq = await playwright.request.newContext();
    ({ token } = await loginBroker(rq, DEFAULT_PHONE));
    await rq.dispose();
  });

  test("TC_PERF_API_01 - overview-stats responds within budget @performance @sanity", async ({ request }) => {
    const { ms, value } = await timed(() => getOverviewStats(request, token, { workspace: "presales" }));
    console.log(`overview-stats: ${ms}ms (status ${value.status})`);
    expect(value.status).toBe(200);
    expect(ms, `overview-stats took ${ms}ms (budget ${API_MAX_MS}ms)`).toBeLessThanOrEqual(API_MAX_MS);
  });

  test("TC_PERF_API_02 - overview-stats survives concurrency without 5xx @performance", async ({
    request,
  }) => {
    const runs = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        timed(() => getOverviewStats(request, token, { workspace: "presales" })),
      ),
    );
    const statuses = runs.map((r) => r.value.status);
    const latencies = runs.map((r) => r.ms).sort((a, b) => a - b);
    const max = latencies[latencies.length - 1];
    const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))];
    console.log(`overview-stats x${CONCURRENCY}: statuses=${statuses.join(",")} p95=${p95}ms max=${max}ms`);

    // The core guard: concurrency must not tip the DB pool into 5xx.
    const serverErrors = statuses.filter((s) => s >= 500);
    expect(serverErrors, `got ${serverErrors.length} 5xx under ${CONCURRENCY} concurrent requests`).toHaveLength(0);
    expect(statuses.every((s) => s === 200)).toBe(true);
    // Soft-ish latency ceiling: 3x the single-request budget under load.
    expect(max, `slowest concurrent request ${max}ms`).toBeLessThanOrEqual(API_MAX_MS * 3);
  });

  test("TC_PERF_API_03 - microsites pagination is healthy across pages @performance", async ({
    request,
  }) => {
    for (let i = 0; i < PAGES; i++) {
      const offset = i * PAGE_LIMIT;
      const { ms, value } = await timed(() =>
        getMicrosites(request, token, { limit: PAGE_LIMIT, offset, workspace: "presales" }),
      );
      console.log(`microsites page ${i + 1} (offset ${offset}): ${ms}ms status ${value.status}`);
      expect(value.status, `pagination page ${i + 1} returned ${value.status}`).toBe(200);
      expect(ms).toBeLessThanOrEqual(API_MAX_MS);
    }
  });

  test("TC_PERF_API_04 - recent-activity responds within budget @performance", async ({ request }) => {
    const { ms, value } = await timed(() => getRecentActivity(request, token, { limit: 25 }));
    console.log(`recent-activity: ${ms}ms (status ${value.status})`);
    expect(value.status).toBe(200);
    expect(ms).toBeLessThanOrEqual(API_MAX_MS);
  });
});

test.describe("Performance — page load", () => {
  test.setTimeout(120_000);

  for (const tab of ["overview", "leads"] as const) {
    test(`TC_PERF_PAGE_${tab} - ${tab} loads within budget @performance`, async ({ page }) => {
      await loginViaUI(page);
      const start = Date.now();
      await gotoTab(page, tab);
      await page.waitForLoadState("load").catch(() => {});
      const wall = Date.now() - start;

      // Prefer the browser's own Navigation Timing when available.
      const navMs = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        return nav ? Math.round(nav.loadEventEnd - nav.startTime) : null;
      });
      const measured = navMs && navMs > 0 ? navMs : wall;
      console.log(`${tab} page load: ${measured}ms (nav=${navMs ?? "n/a"}, wall=${wall}ms)`);
      expect(measured, `${tab} took ${measured}ms (budget ${PAGE_MAX_MS}ms)`).toBeLessThanOrEqual(PAGE_MAX_MS);
    });
  }
});
