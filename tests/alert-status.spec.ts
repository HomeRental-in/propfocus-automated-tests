import { test, expect, APIRequestContext, Page } from '@playwright/test';

const BASE_URL = 'https://dev.propfocus.in';
const SUB_BROKER_PHONE = '9999999999';

const BUYER_NAME = 'Arhan';
const PROJECT_NAME = 'Abhee Tranquila';

// ======================================================
// HELPERS
// ======================================================

async function sendWebhook(
  request: APIRequestContext,
  body: string
) {
  const response = await request.post(
    `${BASE_URL}/api/whatsapp-webhook`,
    {
      timeout: 60000,
      data: {
        event: 'message',
        data: {
          from: SUB_BROKER_PHONE,
          body
        }
      }
    }
  );

  expect(response.status()).toBe(200);

  return await response.json();
}

async function createMicrosite(
  request: APIRequestContext,
  prefix: string
) {
  const buyerId = `${prefix}${Date.now()}`;

  const response = await sendWebhook(
    request,
    `${BUYER_NAME} with ID ${buyerId} for ${PROJECT_NAME}`
  );

  expect(response.success).toBeTruthy();
  expect(response.micrositeUrl).toBeTruthy();

  console.log(`Microsite Created: ${response.micrositeUrl}`);

  return response.micrositeUrl;
}

async function getStatus(
  request: APIRequestContext
) {
  const response = await sendWebhook(
    request,
    'status'
  );

  console.log(
    'FULL STATUS RESPONSE:',
    JSON.stringify(response, null, 2)
  );

  return (
    response?.message ||
    response?.text ||
    response?.reply ||
    JSON.stringify(response)
  );
}

// ======================================================
// TEST SUITE
// ======================================================

test.describe.serial('Microsite Status Alerts', () => {

  test.setTimeout(300000);

  // ====================================================
  // ALERT 1 - SITE VISIT BOOKED
  // ====================================================

  test('ALERT_01 - Site Visit Booked', async ({
    page,
    request
  }) => {

    const microsite = await createMicrosite(
      request,
      'SV'
    );

    await page.goto(microsite);
    await page.waitForLoadState('networkidle');

    const visitBtn = page
      .locator(
        'button:has-text("Site Visit"), button:has-text("Book Visit")'
      )
      .first();

    await visitBtn.click();

    const confirmBtn = page
      .locator(
        'button:has-text("Submit"), button:has-text("Confirm")'
      )
      .first();

    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(5000);

   const status = await getStatus(request);

console.log('\n===== ALERT_01 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toBe(
  'microsite_status_no_quote'
);
  });

  // ====================================================
  // ALERT 2 - CONTACTED VIA WHATSAPP
  // ====================================================

  test('ALERT_02 - Contacted Via WhatsApp', async ({
    page,
    request
  }) => {

    const microsite = await createMicrosite(
      request,
      'WA'
    );

    await page.goto(microsite);

    const waButton = page
      .locator(
        'a[href*="wa.me"], a[href*="whatsapp"]'
      )
      .first();

    await waButton.click();

    await page.waitForTimeout(3000);

    const status = await getStatus(request);

console.log('\n===== ALERT_02 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toBe(
  'microsite_status_no_quote'
);
  });

  // ====================================================
  // ALERT 3 - URL SHARED
  // ====================================================

  test('ALERT_03 - URL Shared', async ({
    browser,
    request
  }) => {

    const microsite = await createMicrosite(
      request,
      'URL'
    );

    const context = await browser.newContext();

    const page = await context.newPage();

    await page.goto(microsite);

    await page.waitForTimeout(5000);

    await context.close();

    const status = await getStatus(request);

console.log('\n===== ALERT_03 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toBe(
  'microsite_status_no_quote'
);
    });

  // ====================================================
  // ALERT 4 - 3+ MINUTES SPENT
  // ====================================================

  test('ALERT_04 - 3+ Minutes On Microsite', async ({
    page,
    request
  }) => {

    const microsite = await createMicrosite(
      request,
      'TIME'
    );

    await page.goto(microsite);

    for (let i = 0; i < 37; i++) {
      await page.mouse.wheel(0, 300);

      await page.waitForTimeout(5000);
    }

    const status = await getStatus(request);

console.log('\n===== ALERT_04 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toMatch(
  /time|minute|min/i
);
});

  // ====================================================
  // ALERT 5 - 5+ VISITS
  // ====================================================

  test('ALERT_05 - 5+ Visits On Project Details', async ({
    page,
    request
  }) => {

    const microsite = await createMicrosite(
      request,
      'VISIT'
    );

    for (let i = 1; i <= 5; i++) {

      await page.goto(microsite);

      await page.waitForLoadState('networkidle');

      const detailsBtn = page
        .locator(
          'button:has-text("Details"), button:has-text("Know More")'
        )
        .first();

      if (
        await detailsBtn.isVisible().catch(() => false)
      ) {
        await detailsBtn.click();
      }

      await page.waitForTimeout(2000);

      console.log(`Visit ${i}`);
    }

    const status = await getStatus(request);

console.log('\n===== ALERT_05 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toBe(
  'microsite_status_no_quote'
);
    });
  // ====================================================
  // ALERT 6 - DEFAULT MESSAGE
  // ====================================================

  test('ALERT_06 - No Meaningful Engagement', async ({
    request
  }) => {

    await createMicrosite(
      request,
      'DEFAULT'
    );

    const status = await getStatus(request);

console.log('\n===== ALERT_06 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

    expect(status).toBe(
  'microsite_status_no_quote'
);
  });
  
});