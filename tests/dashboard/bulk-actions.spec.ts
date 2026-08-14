import { test, expect } from "@playwright/test";
import { loginViaUI, gotoTab } from "../../utils/uiLogin";
import { loginBroker } from "../../utils/dashboardApi";
import { API_BASE, DEFAULT_PHONE } from "../../utils/buyerLinks";

/**
 * Bulk actions + reassignment on All Leads.
 *
 * Selectors grounded in PropFocusDashboard.jsx:
 *   row/select-all checkbox → input.pf-leads-cb
 *   bulk bar                → .pf-leads-bulkbar (appears once rows are selected)
 *   more actions            → button "More actions" → menu with Reassign / status changes
 *   reassign endpoint       → PATCH /dashboard/leads/reassign { leadIds, targetBrokerId }
 *
 * The UI tests are intentionally NON-destructive: they open the reassign modal
 * and cancel. Confirming reassign/archive/mark-lost would mutate shared dev data,
 * so those mutations are asserted only via the API contract (validation), not by
 * clicking confirm.
 */

test.describe("Bulk actions & reassignment — UI", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
    await gotoTab(page, "leads");
    // Desktop leads table must be present with at least one row to select.
    await expect(page.locator("table.pf-leads-table")).toBeVisible({ timeout: 20_000 });
  });

  test("TC_BULK_01 - selecting rows reveals the bulk action bar @sanity", async ({ page }) => {
    const checkboxes = page.locator("input.pf-leads-cb");
    test.skip((await checkboxes.count()) <= 1, "No lead rows to select in this dataset.");
    // The first checkbox is the header select-all.
    await checkboxes.first().check();
    await expect(page.locator(".pf-leads-bulkbar")).toBeVisible();
  });

  test("TC_BULK_02 - Clear deselects everything and hides the bar @regression", async ({ page }) => {
    const checkboxes = page.locator("input.pf-leads-cb");
    test.skip((await checkboxes.count()) <= 1, "No lead rows to select in this dataset.");
    await checkboxes.first().check();
    const bar = page.locator(".pf-leads-bulkbar");
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: /Clear/i }).click();
    await expect(bar).toBeHidden();
  });

  test("TC_BULK_03 - 'More actions' exposes Reassign / status changes @regression", async ({
    page,
  }) => {
    const checkboxes = page.locator("input.pf-leads-cb");
    test.skip((await checkboxes.count()) <= 1, "No lead rows to select in this dataset.");
    await checkboxes.first().check();

    const more = page.locator(".pf-leads-bulkbar").getByRole("button", { name: /More actions/i });
    test.skip((await more.count()) === 0, "No overflow actions menu on this tab.");
    await more.click();
    await expect(page.getByRole("button", { name: "Reassign" })).toBeVisible();
  });

  test("TC_BULK_04 - Reassign opens a modal with candidates and cancels cleanly @regression", async ({
    page,
  }) => {
    const checkboxes = page.locator("input.pf-leads-cb");
    test.skip((await checkboxes.count()) <= 1, "No lead rows to select in this dataset.");
    await checkboxes.first().check();

    const more = page.locator(".pf-leads-bulkbar").getByRole("button", { name: /More actions/i });
    test.skip((await more.count()) === 0, "No overflow actions menu on this tab.");
    await more.click();

    const reassign = page.getByRole("button", { name: "Reassign" });
    test.skip((await reassign.count()) === 0, "Reassign not available for this persona.");
    await reassign.click();

    // Modal shows a target picker; cancel without mutating data.
    const dialog = page.getByRole("dialog").filter({ hasText: /Reassign/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cancel|Close/i }).first().click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("Reassignment — API validation (non-destructive)", () => {
  let token: string;

  test.beforeAll(async ({ playwright }) => {
    const rq = await playwright.request.newContext();
    ({ token } = await loginBroker(rq, DEFAULT_PHONE));
    await rq.dispose();
  });

  test("TC_BULK_API_01 - reassign with no leadIds is rejected @regression", async ({ request }) => {
    const res = await request.patch(`${API_BASE}/dashboard/leads/reassign`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { leadIds: [], targetBrokerId: "" },
    });
    // Either an HTTP error or a success:false payload — but never a silent 200-success.
    if (res.status() === 200) {
      expect((await res.json())?.success).not.toBe(true);
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("TC_BULK_API_02 - reassign requires authentication @security", async ({ request }) => {
    const res = await request.patch(`${API_BASE}/dashboard/leads/reassign`, {
      headers: { "Content-Type": "application/json" },
      data: { leadIds: ["x"], targetBrokerId: "y" },
    });
    expect(res.status()).toBe(401);
  });
});
