import { test, expect, Page } from "@playwright/test";

/**
 * Dashboard responsiveness + mobile behaviour (All Leads).
 *
 * Guards the mobile issues reported by users:
 *  - the page scrolling sideways / buyer cards pushed off-screen to the left
 *    (root cause: the leads filter toolbar not wrapping within the viewport);
 *  - the desktop leads table rendering on phones instead of the card list;
 *  - tapping a lead "hanging" — the expansion must resolve, never stick on a
 *    perpetual "Loading links…" spinner.
 *
 * Runs against BASE_URL (default DEV), phone + fixed dev OTP, matching the
 * existing dashboard specs in this repo.
 */

const BASE_URL = process.env.BASE_URL ?? "https://dev.propfocus.in";
const LOGIN_URL = process.env.DASHBOARD_LOGIN_URL ?? `${BASE_URL}/dashboard/login`;
const LEADS_URL = `${BASE_URL}/dashboard?tab=leads`;
const PHONE = process.env.TEST_PHONE ?? "9888898888";
const OTP = process.env.DASHBOARD_OTP ?? "123456";

async function login(page: Page): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Enter Your Phone Number")).toBeVisible();
  await page.locator('input[type="tel"], input[placeholder*="phone" i]').fill(PHONE);
  await page.getByRole("button", { name: "Send OTP" }).click();

  await expect(page.getByText("Enter Verification Code")).toBeVisible({ timeout: 10_000 });
  await page.locator('input[placeholder="000000"], input[maxlength="6"]').fill(OTP);
  await page.getByRole("button", { name: "Verify & Sign In" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

async function gotoLeads(page: Page): Promise<void> {
  await login(page);
  await page.goto(LEADS_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByRole("heading", { name: "All Leads" })).toBeVisible();
}

async function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
}

// ======================================================
// MOBILE (Pixel-sized viewport)
// ======================================================
test.describe("Dashboard responsive — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await gotoLeads(page);
  });

  test("TC_DASH_RESP_01 - All Leads does not scroll horizontally @sanity", async ({ page }) => {
    const { scrollWidth, clientWidth } = await horizontalOverflow(page);
    // 1px slack for sub-pixel rounding. Regression guard for the off-screen
    // buyer-card bug (an unwrapped filter toolbar widened the canvas).
    expect(scrollWidth, "page must not scroll sideways on mobile").toBeLessThanOrEqual(
      clientWidth + 1,
    );
  });

  test("TC_DASH_RESP_02 - shows the mobile card list, not the desktop table", async ({ page }) => {
    await expect(page.locator("table.pf-leads-table")).toHaveCount(0);
  });

  test("TC_DASH_RESP_03 - hamburger opens the off-canvas sidebar", async ({ page }) => {
    const menu = page.getByRole("button", { name: "Open menu" });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
  });

  test("TC_DASH_RESP_04 - tapping a lead expands without hanging on 'Loading links…'", async ({
    page,
  }) => {
    const firstCard = page.locator(".px-3.py-2 button").filter({ hasText: /.+/ }).first();
    test.skip((await firstCard.count()) === 0, "No buyer rows in this dataset to expand.");

    await firstCard.click();
    // The transient spinner must clear — expansion resolves to the timeline, an
    // empty state, or a recoverable error, never a permanent hang.
    await expect(page.getByText("Loading links…")).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page
        .getByText(/Activity ·/)
        .or(page.getByText(/No links found for this buyer\./))
        .or(page.getByText(/Couldn.t load links\./))
        .first(),
    ).toBeVisible();
  });
});

// ======================================================
// DESKTOP
// ======================================================
test.describe("Dashboard responsive — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await gotoLeads(page);
  });

  test("TC_DASH_RESP_05 - renders the desktop leads table at the lg breakpoint", async ({
    page,
  }) => {
    await expect(page.locator("table.pf-leads-table")).toBeVisible();
    // The mobile hamburger is hidden on desktop.
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });
});
