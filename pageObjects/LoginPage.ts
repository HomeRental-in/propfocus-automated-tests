import { expect, Page } from "@playwright/test";
import { clearAndType, clickWhenReady } from "../utils/helpers";

export class LoginPage {
  private readonly emailInput;
  private readonly passwordInput;
  private readonly loginButton;
  private readonly dashboardMarker;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByTestId("login-email");
    this.passwordInput = page.getByTestId("login-password");
    this.loginButton = page.getByTestId("login-submit");
    this.dashboardMarker = page.getByTestId("dashboard-home");
  }

  async goto(): Promise<void> {
    await this.page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(this.emailInput).toBeVisible();
  }

  async login(email: string, password: string): Promise<void> {
    await clearAndType(this.emailInput, email);
    await clearAndType(this.passwordInput, password);
    await clickWhenReady(this.loginButton);
    await expect(this.dashboardMarker).toBeVisible();
  }
}
