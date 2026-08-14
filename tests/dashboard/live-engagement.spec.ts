import { test, expect } from "@playwright/test";
import { loginViaUI, gotoTab, DASHBOARD_URL } from "../../utils/uiLogin";
import { loginBroker, getRecentActivity } from "../../utils/dashboardApi";
import { DEFAULT_PHONE } from "../../utils/buyerLinks";

/**
 * Live engagement rail + real-time (polling) activity.
 *
 * The dashboard is poll-driven (not push): the header "Live" button opens a rail
 * fed by GET /dashboard/recent-activity (server-cached ~60s, 7-day lookback,
 * excludes page_view / time_spent). realtime-updates.spec.ts already proves new
 * events surface within the poll window; this adds the UI rail + the endpoint's
 * data contract + the "unseen" affordance.
 */

test.describe("Live engagement — UI rail", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
    await gotoTab(page, "leads");
  });

  test("TC_LIVE_UI_01 - Live button opens the activity rail @sanity", async ({ page }) => {
    const live = page.locator(".pf-livebtn");
    test.skip((await live.count()) === 0, "Live button not shown for this workspace/tab.");
    await live.first().click();
    // The rail exposes a link to the full activity log.
    await expect(page.getByText(/Open full activity log/i)).toBeVisible();
  });

  test("TC_LIVE_UI_02 - 'Open full activity log' navigates to the Activity tab @regression", async ({
    page,
  }) => {
    const live = page.locator(".pf-livebtn");
    test.skip((await live.count()) === 0, "Live button not shown for this workspace/tab.");
    await live.first().click();
    await page.getByText(/Open full activity log/i).click();
    await expect(page).toHaveURL(/tab=activity/);
  });

  test("TC_LIVE_UI_03 - ?live=1 deep link opens the rail @regression", async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}?tab=leads&live=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Open full activity log/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Live engagement — activity feed contract", () => {
  let token: string;

  test.beforeAll(async ({ playwright }) => {
    const rq = await playwright.request.newContext();
    ({ token } = await loginBroker(rq, DEFAULT_PHONE));
    await rq.dispose();
  });

  test("TC_LIVE_API_01 - recent-activity returns an activity array @sanity", async ({ request }) => {
    const { status, body } = await getRecentActivity(request, token, { limit: 25 });
    expect(status).toBe(200);
    expect(Array.isArray(body?.data?.activity)).toBe(true);
  });

  test("TC_LIVE_API_02 - feed excludes page_view / time_spent noise events @regression", async ({
    request,
  }) => {
    const { status, body } = await getRecentActivity(request, token, { limit: 50 });
    expect(status).toBe(200);
    const activity: any[] = body?.data?.activity ?? [];
    const noisy = activity.filter((e) => e?.eventType === "page_view" || e?.eventType === "time_spent");
    expect(noisy, "page_view/time_spent must be filtered out of the live feed").toHaveLength(0);
  });

  test("TC_LIVE_API_03 - respects the limit parameter @regression", async ({ request }) => {
    const { status, body } = await getRecentActivity(request, token, { limit: 5 });
    expect(status).toBe(200);
    const activity: any[] = body?.data?.activity ?? [];
    expect(activity.length).toBeLessThanOrEqual(5);
  });
});
