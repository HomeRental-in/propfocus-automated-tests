/**
 * Shared browser login for dashboard UI specs (phone + fixed dev OTP).
 * Mirrors the inline login used by dashboard-testing.spec.ts, centralised so
 * every UI spec logs in the same way. Runs against BASE_URL (default DEV).
 */
import { Page, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://dev.propfocus.in";
export const LOGIN_URL = process.env.DASHBOARD_LOGIN_URL ?? `${BASE_URL}/dashboard/login`;
export const DASHBOARD_URL = process.env.DASHBOARD_URL ?? `${BASE_URL}/dashboard`;
export const UI_PHONE = process.env.TEST_PHONE ?? process.env.SUB_BROKER_PHONE ?? "9888898888";
export const UI_OTP = process.env.DASHBOARD_OTP ?? "123456";

export async function loginViaUI(page: Page, phone: string = UI_PHONE): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Enter Your Phone Number")).toBeVisible();
  await page.locator('input[type="tel"], input[placeholder*="phone" i]').fill(phone);
  await page.getByRole("button", { name: "Send OTP" }).click();

  await expect(page.getByText("Enter Verification Code")).toBeVisible({ timeout: 15_000 });
  await page.locator('input[placeholder="000000"], input[maxlength="6"]').fill(UI_OTP);
  await page.getByRole("button", { name: "Verify & Sign In" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/** Navigate to a dashboard tab (?tab=…); overview is the bare /dashboard route. */
export async function gotoTab(page: Page, tab: string): Promise<void> {
  const url = tab === "overview" ? DASHBOARD_URL : `${DASHBOARD_URL}?tab=${tab}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** True when the page has no horizontal overflow (1px slack for sub-pixel rounding). */
export async function pageHasNoHorizontalOverflow(page: Page): Promise<boolean> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  return scrollWidth <= clientWidth + 1;
}
