import { expect, APIRequestContext, Page } from '@playwright/test';
import {
  MicrositeFlagAssertType,
  MicrositeFlagDefinition,
} from './micrositeFlags';

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const LOGIN_URL =
  process.env.DASHBOARD_LOGIN_URL ??
  'https://dev.propfocus.in/dashboard/login';

const DEFAULT_BROKER_PHONE =
  process.env.TEST_PHONE ?? '9888898888';

const OTP = process.env.DASHBOARD_OTP ?? '123456';

export interface MicrositeFlagResponseBody {
  success: boolean;
  message: string;
  micrositeUrl?: string | null;
  imageURL?: string | null;
}

export function uniqueBuyerId(): string {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(100 + Math.random() * 900);
  return `${timestamp}${random}`;
}

export async function sendFlagWebhook(
  request: APIRequestContext,
  messageBody: string,
  phone: string = DEFAULT_BROKER_PHONE
): Promise<MicrositeFlagResponseBody> {
  const payload = {
    event: 'message',
    data: { from: phone, body: messageBody },
  };

  let response = await request.post(API_URL, {
    data: payload,
    timeout: 60000,
  });
  let attempts = 0;

  while (response.status() === 502 && attempts < 3) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
    response = await request.post(API_URL, {
      data: payload,
      timeout: 60000,
    });
  }

  expect(response.status()).toBe(200);

  const body: MicrositeFlagResponseBody = await response.json();

  console.log(`\nBroker  : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(body, null, 2));

  await new Promise((resolve) => setTimeout(resolve, 600));

  return body;
}

export function assertFlagResponse(
  body: MicrositeFlagResponseBody,
  assertType: MicrositeFlagAssertType
): void {
  expect(body.success).toBe(true);
  expect(body.message).toBeTruthy();

  if (assertType === 'rnr') {
    expect(body.micrositeUrl).toBeTruthy();
    expect(body.message.toLowerCase()).toMatch(
      /tried reaching you|tried reaching out|couldn't connect/i
    );
    return;
  }

  if (assertType === 'ambiguous') {
    expect(body.micrositeUrl).toBeFalsy();
    expect(body.message.toLowerCase()).toMatch(
      /ambiguous|clarification|no projects|invalid|could not parse/i
    );
    return;
  }

  expect(body.micrositeUrl).toBeTruthy();
}

export async function generateFlagMicrosite(
  request: APIRequestContext,
  flag: MicrositeFlagDefinition,
  project: string,
  buyerName?: string,
  buyerId?: string
): Promise<{
  body: MicrositeFlagResponseBody;
  buyerName: string;
  buyerId: string;
}> {
  const name = buyerName ?? flag.buyerPrefix;
  const id = buyerId ?? uniqueBuyerId();
  const prompt = `${name} with ID ${id} for ${project} ${flag.keyword}`;

  const body = await sendFlagWebhook(request, prompt);
  assertFlagResponse(body, flag.assertType);

  return { body, buyerName: name, buyerId: id };
}

export async function loginDashboard(
  page: Page,
  phone: string = DEFAULT_BROKER_PHONE
): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const phoneInput = page.locator(
    'input[type="tel"], input[placeholder*="phone" i]'
  );
  await expect(phoneInput).toBeVisible();
  await phoneInput.fill(phone);

  await page.getByRole('button', { name: /send otp/i }).click();
  await expect(page.getByText('Enter Verification Code')).toBeVisible();

  const otpInput = page.locator(
    'input[placeholder="000000"], input[maxlength="6"]'
  );
  await otpInput.fill(OTP);
  await page.getByRole('button', { name: /verify/i }).click();

  await page.waitForURL(/dashboard/, { timeout: 30000 });
}

export async function openAllLeads(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'All Leads' }).click();
  await page.waitForLoadState('networkidle');
}

export async function searchLeadInTable(
  page: Page,
  searchText: string
): Promise<void> {
  await page.getByPlaceholder(/search/i).fill(searchText);
  await page.waitForTimeout(2500);
}

export async function filterByLeadType(
  page: Page,
  leadTypeLabel: string
): Promise<void> {
  await page.getByRole('button', { name: /Lead type/i }).click();
  await page.getByText(leadTypeLabel, { exact: true }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
}

export async function assertLeadVisibleWithTypeFilter(
  page: Page,
  buyerName: string,
  leadTypeLabel: string
): Promise<void> {
  await loginDashboard(page);
  await openAllLeads(page);
  await searchLeadInTable(page, buyerName);
  await filterByLeadType(page, leadTypeLabel);

  await expect(page.locator('table')).toContainText(buyerName);
}
