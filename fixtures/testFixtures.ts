import { test as base } from "@playwright/test";
import { DashboardPage } from "../pageObjects/DashboardPage";
import { LoginPage } from "../pageObjects/LoginPage";
import { MicrositePage } from "../pageObjects/MicrositePage";

type PageFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  micrositePage: MicrositePage;
};

// Central fixture wiring keeps test files focused on business scenarios.
export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  micrositePage: async ({ page }, use) => {
    await use(new MicrositePage(page));
  }
});

export { expect } from "@playwright/test";
