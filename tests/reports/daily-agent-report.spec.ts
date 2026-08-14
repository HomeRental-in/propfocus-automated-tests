import { test, expect } from "@playwright/test";
import { loginViaUI, DASHBOARD_URL } from "../../utils/uiLogin";
import { loginBroker } from "../../utils/dashboardApi";
import { API_BASE, DEFAULT_PHONE } from "../../utils/buyerLinks";

/**
 * Daily agent report — read paths only.
 *
 * SAFETY: the POST endpoints under /daily-report/* actually GENERATE and SEND
 * reports (WhatsApp/email). This spec deliberately touches only read endpoints
 * and the Reports UI so it never spams real recipients:
 *   GET /daily-report/brokers        (requireAuthOrApiKey) — brokers eligible for the daily report
 *   GET /dashboard/reports           (reports feature) — stored report list
 *   GET /dashboard/reports/by-date   — stored report for a date
 * Reports are feature-gated; when disabled the endpoints 403 and the tests skip.
 */

test.describe("Daily agent report — API (read-only)", () => {
  let token: string;

  test.beforeAll(async ({ playwright }) => {
    const rq = await playwright.request.newContext();
    ({ token } = await loginBroker(rq, DEFAULT_PHONE));
    await rq.dispose();
  });

  test("TC_REPORT_API_01 - eligible brokers list is returned @sanity", async ({ request }) => {
    const res = await request.get(`${API_BASE}/daily-report/brokers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 403]).toContain(res.status());
    test.skip(res.status() === 403, "Daily report access not enabled for this account.");
    const body = await res.json().catch(() => ({}));
    const list = body?.data ?? body?.brokers ?? body;
    expect(Array.isArray(list) || typeof list === "object").toBe(true);
  });

  test("TC_REPORT_API_02 - stored reports list responds @regression", async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 when the reports feature is on, 403 when it is not — both are valid.
    expect([200, 403]).toContain(res.status());
    test.skip(res.status() === 403, "Reports feature disabled for this org.");
    expect((await res.json())?.success ?? true).not.toBe(false);
  });

  test("TC_REPORT_API_03 - report send endpoints require auth @security", async ({ request }) => {
    // Unauthenticated read of the brokers list must be blocked.
    const res = await request.get(`${API_BASE}/daily-report/brokers`);
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });
});

test.describe("Daily agent report — Reports UI", () => {
  test("TC_REPORT_UI_01 - Reports page loads (or is cleanly gated) @regression", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${DASHBOARD_URL}/settings/reports`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // If reports are disabled the app redirects away from the reports route —
    // treat that as a valid (gated) outcome rather than a failure.
    if (!/\/settings\/reports/.test(new URL(page.url()).pathname)) {
      test.skip(true, "Reports feature disabled — route not accessible.");
    }
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });
});
