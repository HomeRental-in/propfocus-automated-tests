import { test, expect } from "@playwright/test";
import { loginViaUI, DASHBOARD_URL, pageHasNoHorizontalOverflow } from "../../utils/uiLogin";

/**
 * Responsiveness sweep across every dashboard page at mobile / tablet / desktop.
 *
 * The core assertion is "no horizontal scroll" — the failure mode users reported
 * (content pushed off-screen sideways). Each case logs in on its own page so
 * failures don't skip the rest of the matrix.
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

test.describe("Responsiveness — all dashboard pages", () => {
  for (const vp of VIEWPORTS) {
    for (const tab of TABS) {
      const sanity = vp.name === "mobile" && (tab === "overview" || tab === "leads");
      test(`TC_RESP_${vp.name}_${tab} - no horizontal overflow ${sanity ? "@sanity" : "@regression"}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginViaUI(page);
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
