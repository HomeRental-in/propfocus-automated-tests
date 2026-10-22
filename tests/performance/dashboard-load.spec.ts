/**
 * Dashboard DATA-load performance — beyond first paint.
 *
 * Measures, with a real logged-in session:
 *   1. Full dashboard load: navigation → overview-stats response → KPI numbers
 *      actually rendered (data on screen, not shell paint).
 *   2. Every date filter (Today / 7D / 30D / Custom / All): click → stats
 *      response → render settle. The captured request URL is logged so the
 *      exact backend query per filter is visible in the report.
 *   3. All Leads tab: leads/microsites list response → first data row visible.
 *
 * Budgets (override via env):
 *   PERF_DASH_DATA_MAX_MS   full dashboard data load   (default 12000)
 *   PERF_FILTER_MAX_MS      each date-filter reload    (default 8000)
 */
import { test, expect, Page, Response } from '@playwright/test';
import { loginViaUI, DASHBOARD_URL } from '../../utils/uiLogin';

const DASH_BUDGET = Number(process.env.PERF_DASH_DATA_MAX_MS ?? 12_000);
const FILTER_BUDGET = Number(process.env.PERF_FILTER_MAX_MS ?? 8_000);

const STATS_URL = /overview-stats|dashboard\/stats|funnel/;
const LIST_URL = /dashboard\/microsites|dashboard\/leads/;

function isDataResponse(res: Response, pattern: RegExp): boolean {
  return pattern.test(res.url()) && res.status() === 200;
}

/** Wait until a KPI card shows a numeric value (data rendered, not skeleton). */
async function waitForKpiNumbers(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('h1,h2,h3,[class*=kpi],[class*=stat]'));
          return els.some((e) => /^\s*\d[\d,.]*\s*$/.test(e.textContent ?? ''));
        }),
      { timeout: 20_000, message: 'KPI numbers should render' }
    )
    .toBe(true);
}

test.describe('Dashboard data-load performance', () => {
  test.setTimeout(240_000);

  test('TC_PERF_DASH_01 - dashboard loads DATA within budget @performance @sanity', async ({ page }) => {
    const t0 = Date.now();
    const statsPromise = page.waitForResponse((r) => isDataResponse(r, STATS_URL), { timeout: 30_000 });
    await loginViaUI(page);
    const statsRes = await statsPromise;
    const apiMs = Date.now() - t0;

    await waitForKpiNumbers(page);
    const renderMs = Date.now() - t0;

    console.log(`stats request : ${statsRes.request().url()}`);
    console.log(`login+API data: ${apiMs}ms | data rendered: ${renderMs}ms (budget ${DASH_BUDGET}ms)`);
    expect(renderMs, `dashboard data render took ${renderMs}ms`).toBeLessThanOrEqual(DASH_BUDGET);
  });

  test('TC_PERF_DASH_02 - every date filter reloads data within budget @performance', async ({ page }) => {
    await loginViaUI(page);
    await waitForKpiNumbers(page);

    const timings: Record<string, number> = {};
    const failures: string[] = [];

    for (const filter of ['Today', '7D', '30D', 'All'] as const) {
      const t0 = Date.now();
      const resPromise = page
        .waitForResponse((r) => isDataResponse(r, STATS_URL), { timeout: FILTER_BUDGET + 12_000 })
        .catch(() => null);
      await page.getByRole('button', { name: filter, exact: true }).click();
      const res = await resPromise;
      if (res) console.log(`[${filter}] request: ${res.request().url()}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      const ms = Date.now() - t0;
      timings[filter] = ms;
      console.log(`[${filter}] data reload: ${ms}ms (budget ${FILTER_BUDGET}ms)`);
      if (ms > FILTER_BUDGET) failures.push(`${filter}=${ms}ms`);
    }

    // Custom range: last 30 days, applied through the date-range UI when present.
    const custom = page.getByRole('button', { name: 'Custom', exact: true });
    if (await custom.isVisible().catch(() => false)) {
      const t0 = Date.now();
      await custom.click();
      const dateInputs = page.locator('input[type="date"]');
      if ((await dateInputs.count().catch(() => 0)) >= 2) {
        const end = new Date();
        const start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        await dateInputs.nth(0).fill(iso(start));
        await dateInputs.nth(1).fill(iso(end));
        const apply = page.getByRole('button', { name: /apply|go|filter/i }).first();
        const resPromise = page
          .waitForResponse((r) => isDataResponse(r, STATS_URL), { timeout: FILTER_BUDGET + 12_000 })
          .catch(() => null);
        if (await apply.isVisible().catch(() => false)) await apply.click();
        await resPromise;
        await page.waitForLoadState('networkidle').catch(() => {});
        const ms = Date.now() - t0;
        timings['Custom(30d)'] = ms;
        console.log(`[Custom 30d] data reload: ${ms}ms (budget ${FILTER_BUDGET}ms)`);
        if (ms > FILTER_BUDGET) failures.push(`Custom=${ms}ms`);
      } else {
        console.log('[Custom] no date inputs found — UI shape changed, skipping timing');
      }
    }

    console.log(`Filter timings: ${JSON.stringify(timings)}`);
    expect(failures, `filters over ${FILTER_BUDGET}ms budget: ${failures.join(', ')}`).toHaveLength(0);
  });

  test('TC_PERF_DASH_03 - All Leads grid loads data within budget @performance', async ({ page }) => {
    await loginViaUI(page);

    const t0 = Date.now();
    const resPromise = page
      .waitForResponse((r) => isDataResponse(r, LIST_URL), { timeout: 30_000 })
      .catch(() => null);
    await page.getByText('All Leads', { exact: true }).first().click();
    const res = await resPromise;
    if (res) console.log(`leads request: ${res.request().url()}`);

    // Data, not paint: a lead row / card must be visible.
    await expect
      .poll(
        async () => page.locator('table tbody tr, [class*=lead-row], [class*=leadCard]').count(),
        { timeout: 20_000, message: 'lead rows should render' }
      )
      .toBeGreaterThan(0);

    const ms = Date.now() - t0;
    console.log(`All Leads data load: ${ms}ms (budget ${DASH_BUDGET}ms)`);
    expect(ms, `All Leads data load took ${ms}ms`).toBeLessThanOrEqual(DASH_BUDGET);
  });
});
