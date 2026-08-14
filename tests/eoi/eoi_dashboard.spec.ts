import { test, expect, Page } from '@playwright/test';

const LOGIN_URL = 'https://dev.propfocus.in/dashboard/login';
const PHONE = '9999999999';
const OTP = '123456';
async function login(page: Page) {
  await page.goto(LOGIN_URL);

  await page.getByLabel(/phone number/i).fill(PHONE);

  await page.getByRole('button', {
    name: /send otp/i
  }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Enter Verification Code'
    })
  ).toBeVisible();

  await page.getByLabel(/verification code/i).fill(OTP);

  await page.getByRole('button', {
    name: 'Verify & Sign In'
  }).click();

  await page.waitForURL(/dashboard/, {
    timeout: 15000
  });
}

test('should create EOI page with valid details @sanity', async ({ page }) => {

  await login(page);

  await page.getByRole('button', {
    name: 'Create EOI page'
  }).click();

  await expect(
    page.getByText('EOI Page Link')
  ).toBeVisible();

  await page
    .getByPlaceholder(/client or lead name/i)
    .fill('John Doe');

  await page
    .getByPlaceholder(/required/i)
    .fill('B12345');

  // await page
  //   .getByPlaceholder(/search eoi campaigns/i)
  //   .fill('Pre');
await expect(
  page.getByText('Pride Pre launch', { exact: true })
).toBeVisible();
  await page.getByText('Pride Pre launch', { exact: true }).click();



  await page.getByRole('button', {
    name: /generate eoi link/i
  }).click();
});