import { test, expect, Page } from "@playwright/test";
import { loginViaUI, DASHBOARD_URL, pageHasNoHorizontalOverflow } from "../../utils/uiLogin";

/**
 * Responsiveness sweep across every dashboard page at mobile / tablet / desktop.
 *
 * The core assertion is "no horizontal scroll" — the failure mode users reported
 * (content pushed off-screen sideways). One shared, logged-in page is reused
 * (serial mode) and simply resized + re-navigated per case to keep the sweep fast.
 *
 * Feature-gated tabs (eoi/post-visit) may render an empty or gated state; that is
 * fine — an empty state must still not overflow, which is exactly what we assert.
 */

const TABS = [
  "overview",
  "leads",
  "site-visit-tracker",
  "post-visit-tracker",
  "eoi-tracker",
  "priority-list",
  "archived",
  "agents",
  "projects",
  "activity",
] as const;

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

test.describe.configure({ mode: "serial" });

test.describe("Responsiveness — all dashboard pages", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  for (const vp of VIEWPORTS) {
    for (const tab of TABS) {
      const sanity = vp.name === "mobile" && (tab === "overview" || tab === "leads");
      test(`TC_RESP_${vp.name}_${tab} - no horizontal overflow ${sanity ? "@sanity" : "@regression"}`, async () => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const url = tab === "overview" ? DASHBOARD_URL : `${DASHBOARD_URL}?tab=${tab}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(300); // let responsive layout settle

        const ok = await pageHasNoHorizontalOverflow(page);
        expect(ok, `"${tab}" @ ${vp.name} (${vp.width}px) scrolls horizontally`).toBe(true);
      });
    }
  }
});
