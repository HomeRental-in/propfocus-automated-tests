import {
  test,
  expect,
  Page,
  APIRequestContext,
} from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';

test.setTimeout(120000);

let micrositeUrl = '';
let buyerId = '';
const OTP = '123456';
const BUYER_NAME = 'Arhan';
const PROJECT_NAME = 'Abhee Tranquila';
const LOGIN_URL = 'https://dev.propfocus.in/dashboard/login';
const PHONE = {
  MAIN: BROKER_PHONE.MAIN_BROKER,
} as const;

async function sendWebhookRequest(request: APIRequestContext, messageBody: string) {
  const response = await request.post('https://dev.propfocus.in/api/whatsapp-webhook', {
    data: {
      event: 'message',
      data: {
        from: PHONE.MAIN,
        body: messageBody
      }
    }
  });
  expect(response.status()).toBe(200);
  return await response.json();
}

async function login(page: Page, phone: string = PHONE.MAIN) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i]');
  await expect(phoneInput).toBeVisible({ timeout: 30000 });
  await phoneInput.fill(phone);
  await page.getByRole('button', { name: /send otp/i }).click();

  await expect(page.getByText('Enter Verification Code')).toBeVisible({ timeout: 15000 });
  const otpInput = page.locator('input[placeholder="000000"], input[maxlength="6"]');
  await otpInput.fill(OTP);
  await page.getByRole('button', { name: /verify/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30000 });
}

test.beforeAll(async ({ request }) => {
  buyerId = `UJ5${Date.now().toString().slice(-6)}`;

  console.log(
    `Generated buyerId: ${buyerId}`
  );
  const responseBody = await sendWebhookRequest(
    request,
    `${BUYER_NAME} with ID ${buyerId} for ${PROJECT_NAME}`
    
  );
  expect(responseBody.success).toBe(true);
  micrositeUrl = responseBody.micrositeUrl;
  console.log(`Generated Microsite: ${micrositeUrl}`);
});

test('UJ5_STEP_01 - Generate Microsite', async () => {
  expect(micrositeUrl).toContain('propfocus');
  console.log(`Microsite Ready: ${micrositeUrl}`);
  console.log(
  `Generated buyerId: ${buyerId}`
);
});

test('UJ5_STEP_02 - Open Microsite', async ({ page }) => {
  await page.goto(micrositeUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(BUYER_NAME)).toBeVisible();
  await expect(page.getByText(PROJECT_NAME)).toBeVisible();
  console.log(`Microsite opened: ${micrositeUrl}`);
});

test('UJ5_STEP_03 - Click Phone CTA', async ({ page }) => {
  await page.goto(micrositeUrl);
  await page.waitForLoadState('networkidle');
  const [newPage] = await Promise.all([
    page.context().waitForEvent('page').catch(() => null),
    page.locator('a[href^="tel:"]').first().click(),
  ]);
  if (newPage) await newPage.waitForTimeout(1000);
  console.log('Phone CTA clicked ✓');
});

test('UJ5_STEP_04 - Verify Phone CTA Event', async ({ page }) => {
  let eventCaptured = false;
  page.on('response', async response => {
    try {
      const body = await response.json();
      if (body.eventType && body.eventType.includes('call')) {
        eventCaptured = true;
      }
    } catch {}
  });

  await page.goto(micrositeUrl);
  await page.locator('a[href^="tel:"]').first().click();
  await page.waitForTimeout(3000);
  console.log('Phone CTA event logged ✓');
  expect(eventCaptured).toBeTruthy();
});

test('UJ5_STEP_05 - Click WhatsApp CTA', async ({ page }) => {
  await page.goto(micrositeUrl);
  await page.waitForLoadState('networkidle');
  const [newPage] = await Promise.all([
    page.context().waitForEvent('page').catch(() => null),
    page.locator('a[href^="https://wa.me"]').first().click(),
  ]);
  if (newPage) await newPage.waitForTimeout(1000);
  console.log('WhatsApp CTA clicked ✓');
});

test('UJ5_STEP_06 - Verify WhatsApp CTA Event', async ({ page }) => {
  let eventCaptured = false;
  page.on('response', async response => {
    try {
      if (response.url().includes('event') || response.url().includes('analytics')) {
        const body = await response.json();
        if (body.eventType && body.eventType.includes('wa')) {
          eventCaptured = true;
        }
      }
    } catch {}
  });

  await page.goto(micrositeUrl);
  await page.locator('a[href^="https://wa.me"]').first().click();
  await page.waitForTimeout(3000);
  console.log('WhatsApp CTA event logged ✓');
  expect(eventCaptured).toBeTruthy();
});

test('UJ5_STEP_07 - Click Request Live Inventory', async ({ page }) => {
  await page.goto(micrositeUrl);
  
  const viewDetailsBtn = page.getByRole('button', { name: /view details/i }).first();
  if (await viewDetailsBtn.isVisible()) {
    await viewDetailsBtn.click();
  }

  const [newPage] = await Promise.all([
    page.context().waitForEvent('page').catch(() => null),
    page.getByRole('button', { name: /request live inventory/i }).click()
  ]);

  if (newPage) await newPage.waitForTimeout(1000);
  console.log('Request Live Inventory clicked ✓');
});

test('UJ5_STEP_08 - Verify Inventory Event', async ({ page }) => {
  let eventCaptured = false;
  page.on('response', async response => {
    try {
      const body = await response.json();
      if (body.eventType === 'contact_wa_call' || body.eventType === 'inventory') {
        eventCaptured = true;
      }
    } catch {}
  });

  await page.goto(micrositeUrl);
  const viewDetailsBtn = page.getByRole('button', { name: /view details/i }).first();
  if (await viewDetailsBtn.isVisible()) {
    await viewDetailsBtn.click();
  }
  await page.getByRole('button', { name: /request live inventory/i }).click();
  await page.waitForTimeout(3000);
  console.log('Inventory event logged ✓');
  expect(eventCaptured).toBeTruthy();
});

test('UJ5_STEP_09 - Verify Lead Appears In Dashboard', async ({ page }) => {
  await login(page);
  await page.getByText('All Leads', { exact: true }).click();
  await page.waitForLoadState('networkidle');

  const searchBox = page.getByPlaceholder(/search/i);
  await searchBox.fill(buyerId);
  await page.waitForTimeout(2000);

  const leadRow = page.locator('table tbody tr').first();
  await expect(leadRow).toBeVisible();
  console.log(`Lead ${buyerId} found ✓`);
});

test('UJ5_STEP_10 - Verify Communication Events In Timeline', async ({ page }) => {
  await login(page);
  await page.getByText('All Leads', { exact: true }).click();
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder(/search/i).fill(buyerId);
  await page.waitForTimeout(2000);

  const leadRow = page.locator('table tbody tr').first();
  await expect(leadRow).toBeVisible();
  await leadRow.click();
  
  await expect(page.getByText('Timeline', { exact: false })).toBeVisible();
  console.log('Timeline visible ✓');
});

test(
  'UJ5_STEP_11 - Schedule Site Visit',
  async ({ page }) => {

    await login(page);

    await page
      .getByRole('button', {
        name: /confirm site visit/i
      })
      .click();

    await expect(
      page.getByText(
        'Generate Site Visit'
      )
    ).toBeVisible();

    // Full Name
    await page
      .getByPlaceholder(
        /client or lead name/i
      )
      .fill(BUYER_NAME);

    // Buyer ID
    await page
      .getByPlaceholder(
        /required/i
      )
      .fill(buyerId);

    // Search project
    await page
      .getByPlaceholder(
        /search projects/i
      )
      .fill(PROJECT_NAME);

    await page.waitForTimeout(2000);

    // Select project checkbox / option
    const projectOption =
      page.getByText(
        PROJECT_NAME,
        { exact: true }
      );

    await expect(
      projectOption
    ).toBeVisible();

    await projectOption.click();

    console.log(
      `${PROJECT_NAME} selected ✓`
    );

    // Verify Generate button becomes enabled
    const generateBtn =
      page.getByRole('button', {
        name: 'Generate',
        exact: true
      });

    await expect(
      generateBtn
    ).toBeEnabled();

    console.log(
      'Generate button enabled ✓'
    );

    await generateBtn.click();

    console.log(
      'Generate clicked ✓'
    );

    // Wait for backend processing
    await page.waitForLoadState('networkidle');

    // Debug info
    console.log(
      `Buyer Name: ${BUYER_NAME}`
    );

    console.log(
      `Buyer ID: ${buyerId}`
    );

    console.log(
      `Project: ${PROJECT_NAME}`
    );

    await page.screenshot({
      path: 'site-visit-created.png',
      fullPage: true
    });

    console.log(
      'Site Visit Scheduled ✓'
    );

  }
);
test(
  'UJ5_STEP_12 - Verify Site Visit Tracker Updated',
  async ({ page }) => {

    await login(page);

    await page
      .getByText(
        'Site Visit Tracker',
        { exact: true }
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    console.log(
      `Searching for Buyer ID: ${buyerId}`
    );

    const searchBox =
      page.getByPlaceholder(
        /search/i
      );

    await searchBox.clear();
    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(
      5000
    );

    const matchingRow =
      page.locator(
        'table tbody tr'
      ).filter({
        hasText: buyerId
      });

    await expect(
      matchingRow
    ).toBeVisible({
      timeout: 30000
    });

    await expect(
      matchingRow
    ).toContainText(
      BUYER_NAME
    );

    await expect(
      matchingRow
    ).toContainText(
      PROJECT_NAME
    );

    await expect(
      matchingRow
    ).toContainText(
      'Pending'
    );

    console.log(
      `Buyer ${buyerId} found ✓`
    );

    console.log(
      `Project ${PROJECT_NAME} verified ✓`
    );

    console.log(
      'Site Visit status verified ✓'
    );

  }
);
test(
  'UJ5_STEP_13 - Verify Booked Site Visit Event',
  async ({ page }) => {

    await login(page);

    await page
      .getByText(
        'Site Visit Tracker',
        { exact: true }
      )
      .click();

    const searchBox =
      page.getByPlaceholder(
        /search/i
      );

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(
      2000
    );

    await page
      .locator(
        'table tbody tr'
      )
      .first()
      .click();

    await expect(
      page.getByText(
        /Booked site visit/i
      )
    ).toBeVisible();

    console.log(
      'Booked site visit verified ✓'
    );

  }
);