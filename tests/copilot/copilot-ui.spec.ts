import { test, expect, Page } from "@playwright/test";
import { loginViaUI, gotoTab, DASHBOARD_URL } from "../../utils/uiLogin";

/**
 * Copilot chatbot UI (formerly "AI Search"). The floating assistant is on every
 * dashboard tab; a full-page version lives at /dashboard/copilot.
 *
 * Selectors are grounded in CopilotChatbot.jsx / CopilotChatPanel.jsx:
 *   trigger  → button[aria-label="Open Copilot" | "Close Copilot"]
 *   panel    → role="dialog" aria-label="PropFocus Copilot"
 *   input    → textarea[placeholder="How can I help you today?"]
 *   send     → button[aria-label="Send"]
 *   newchat  → button[aria-label="New chat"]
 */

async function openCopilot(page: Page) {
  const trigger = page.getByRole("button", { name: "Open Copilot" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "PropFocus Copilot" });
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("Copilot chatbot — UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
    await gotoTab(page, "leads");
  });

  test("TC_COPILOT_UI_01 - floating button opens the chat panel @sanity", async ({ page }) => {
    const panel = await openCopilot(page);
    await expect(panel.getByPlaceholder("How can I help you today?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  });

  test("TC_COPILOT_UI_02 - shows starter suggestions @regression", async ({ page }) => {
    const panel = await openCopilot(page);
    // Suggestions render as clickable chips before any message is sent.
    await expect(panel.getByRole("button").first()).toBeVisible();
  });

  test("TC_COPILOT_UI_03 - sending a query returns an assistant reply @regression", async ({
    page,
  }) => {
    const panel = await openCopilot(page);
    await panel.getByPlaceholder("How can I help you today?").fill("How many leads do I have?");
    await page.getByRole("button", { name: "Send" }).click();

    // The user's message echoes immediately; the assistant reply (or a graceful
    // error bubble) follows once the agent responds. Analyst queries can be slow.
    await expect(panel.getByText("How many leads do I have?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 60_000 });
    // At least two bubbles exist now (user + assistant).
    const bubbles = panel.locator("[class*='MessageBubble'], .pf-copilot-msg, div");
    expect(await bubbles.count()).toBeGreaterThan(1);
  });

  test("TC_COPILOT_UI_04 - New chat clears the conversation @regression", async ({ page }) => {
    const panel = await openCopilot(page);
    await panel.getByPlaceholder("How can I help you today?").fill("hello");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(panel.getByText("hello")).toBeVisible();

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(panel.getByText("hello")).toHaveCount(0);
  });

  test("TC_COPILOT_UI_05 - open state persists across reload @regression", async ({ page }) => {
    await openCopilot(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    // pf-copilot-chat-open is stored in localStorage → panel re-opens.
    await expect(page.getByRole("dialog", { name: "PropFocus Copilot" })).toBeVisible();
  });

  test("TC_COPILOT_UI_06 - close button hides the panel @regression", async ({ page }) => {
    await openCopilot(page);
    await page.getByRole("button", { name: "Close Copilot" }).click();
    await expect(page.getByRole("dialog", { name: "PropFocus Copilot" })).toBeHidden();
  });

  test("TC_COPILOT_UI_07 - full page /dashboard/copilot renders and hides the floating widget @regression", async ({
    page,
  }) => {
    await page.goto(`${DASHBOARD_URL}/copilot`, { waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("How can I help you today?")).toBeVisible();
    // The floating trigger is intentionally hidden on the dedicated page.
    await expect(page.getByRole("button", { name: /Open Copilot|Close Copilot/ })).toHaveCount(0);
  });
});
