import { expect, Locator, Page } from "@playwright/test";

export const waitForVisible = async (locator: Locator): Promise<void> => {
  await expect(locator).toBeVisible();
};

export const clickWhenReady = async (locator: Locator): Promise<void> => {
  await waitForVisible(locator);
  await locator.click();
};

export const clearAndType = async (locator: Locator, value: string): Promise<void> => {
  await waitForVisible(locator);
  await locator.fill("");
  await locator.fill(value);
};

export const openInNewTab = async (page: Page, url: string): Promise<Page> => {
  const newPage = await page.context().newPage();
  await newPage.goto(url, { waitUntil: "domcontentloaded" });
  return newPage;
};

export const randomPhoneNumber = (): string => {
  const suffix = Math.floor(100_000 + Math.random() * 900_000);
  return `98765${suffix}`;
};
