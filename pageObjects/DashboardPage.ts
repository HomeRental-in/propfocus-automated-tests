import { expect, Page } from "@playwright/test";
import { clickWhenReady } from "../utils/helpers";

export class DashboardPage {
  private readonly dashboardRoot;
  private readonly micrositeNavLink;
  private readonly micrositePageRoot;

  constructor(private readonly page: Page) {
    this.dashboardRoot = page.getByTestId("dashboard-home");
    this.micrositeNavLink = page.getByTestId("nav-microsite");
    this.micrositePageRoot = page.getByTestId("microsite-form");
  }

  async ensureLoaded(): Promise<void> {
    await expect(this.dashboardRoot).toBeVisible();
  }

  async goToMicrositeGenerator(): Promise<void> {
    await clickWhenReady(this.micrositeNavLink);
    await expect(this.micrositePageRoot).toBeVisible();
  }
}
