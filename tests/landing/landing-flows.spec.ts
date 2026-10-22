// ======================================================
// MARKETING LANDING PAGE FLOWS
//
// Book-a-Demo CTA (modal: name / company / phone → submit → OTP step when
// enabled) and the Case Studies section. Runs against BASE_URL, so the same
// checks gate dev, staging, and (read-only parts) prod.
// ======================================================
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://dev.propfocus.in';
const DEMO_PHONE = process.env.TEST_PHONE ?? '9888898888';

test.describe('Landing page — Book a Demo', () => {
  test('LAND_DEMO_01 - CTA opens the demo form @sanity', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('a:has-text("Book a Demo"), button:has-text("Book a Demo")').first().click();

    await expect(page.locator('input[placeholder*="Sharma" i], input[type="tel"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('LAND_DEMO_02 - demo request submits end-to-end @sanity', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator('a:has-text("Book a Demo"), button:has-text("Book a Demo")').first().click();

    const name = page.locator('input[placeholder*="Aakash" i]').first();
    await name.waitFor({ timeout: 10_000 });
    await name.fill('E2E Automation');
    await page.locator('input[placeholder*="Developers" i]').first().fill('Automation Test Org');
    await page.locator('input[type="tel"]').first().fill(DEMO_PHONE);

    const submitRes = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/(?!.*sentry)/.test(r.url()),
      { timeout: 20_000 }
    );
    await page.getByRole('button', { name: /book|submit|request|demo|continue|send/i }).last().click();
    const res = await submitRes;
    console.log(`demo submit -> ${res.status()} ${res.url()}`);
    expect(res.status(), 'demo submission should not error').toBeLessThan(500);

    // OTP step (when the flow verifies the phone): use the dev OTP convention.
    const body = await res.json().catch(() => ({} as any));
    const otpInput = page.locator('input[placeholder="000000"], input[maxlength="6"], input[autocomplete="one-time-code"]').first();
    if (await otpInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const otp = body?.data?.devOtp ?? process.env.DASHBOARD_OTP ?? '123456';
      await otpInput.fill(String(otp));
      await page.getByRole('button', { name: /verify|confirm|submit/i }).first().click();
      await page.waitForTimeout(2_000);
    }

    await expect(
      page.getByText(/thank|received|touch|scheduled|confirmed|success/i).first(),
      'demo flow should end in a success state'
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Landing page — Case Studies', () => {
  test('LAND_CASE_01 - case studies list renders @sanity', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/case-studies`, { waitUntil: 'domcontentloaded' });
    expect(res?.status(), '/case-studies should be served').toBe(200);
    await page.waitForLoadState('networkidle').catch(() => {});

    const cards = page.locator('a[href*="case-stud"], article, [class*="case"]');
    await expect
      .poll(async () => cards.count(), { timeout: 15_000, message: 'case study entries should render' })
      .toBeGreaterThan(0);
  });

  test('LAND_CASE_02 - a case study opens and renders content @regression', async ({ page }) => {
    await page.goto(`${BASE_URL}/case-studies`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const link = page.locator('a[href*="case-stud"]:not([href$="/case-studies"])').first();
    await expect(link, 'at least one case study link').toBeVisible({ timeout: 15_000 });
    await link.click();
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
    const text = await page.evaluate(() => document.body.innerText.length);
    expect(text, 'case study should have real content').toBeGreaterThan(500);
  });
});
