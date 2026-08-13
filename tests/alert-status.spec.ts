import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import { BROKER_PHONE } from '../utils/brokerPhones';

const SESSION_DIR = './whatsapp-session';

async function getStatusFromWhatsApp(
  micrositeUrl: string
) {
  const context =
    await chromium.launchPersistentContext(
      SESSION_DIR,
      {
        headless: false
      }
    );

  let page = context.pages()[0];

  if (!page) {
    page = await context.newPage();
  }

  await page.goto('https://web.whatsapp.com');

  await page.waitForTimeout(5000);

  const chat = page.getByText(
    'PropFocus AI',
    { exact: true }
  );

  await chat.click();

  const micrositeCode =
  micrositeUrl.split('/').pop();

const micrositeMessage = page
  .locator('[data-testid="msg-container"]')
  .filter({
    hasText: micrositeCode
  })
  .last();

await expect(
  micrositeMessage
).toBeVisible({
  timeout: 20000
});

console.log(
  `Checking status for ${micrositeCode}`
);

await micrositeMessage.hover();

await page.waitForTimeout(1000);

let replyClicked = false;

for (let i = 0; i < 3; i++) {
  try {

    await micrositeMessage.click({
      button: 'right',
      force: true
    });

    await page.waitForTimeout(2000);

    const replyItem = page
      .locator('[role="menuitem"]')
      .filter({
        hasText: 'Reply'
      })
      .first();

    if (await replyItem.isVisible()) {
      await replyItem.click();
      replyClicked = true;
      break;
    }

  } catch (e) {
    console.log(
      `Reply attempt ${i + 1} failed`
    );
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

if (!replyClicked) {
  await page.screenshot({
    path: 'reply-failed.png',
    fullPage: true
  });

  throw new Error(
    `Could not reply to message containing ${micrositeCode}`
  );
}

const messageBox = page
  .locator(
    'div[contenteditable="true"][role="textbox"]'
  )
  .last();

await messageBox.fill('status');

await page.keyboard.press('Enter');

await page.waitForTimeout(10000);

const response = await page
  .locator('[data-testid="msg-container"]')
  .last()
  .textContent();

await context.close();

return response || '';
}
const BASE_URL = 'https://dev.propfocus.in';
const SUB_BROKER_PHONE = BROKER_PHONE.MAIN_BROKER;

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



// ======================================================
// TEST SUITE
// ======================================================

test.describe('Microsite Status Alerts', () => {

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

   const status =
  await getStatusFromWhatsApp(
    microsite
  );

console.log('\n===== ALERT_01 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toMatch(
  /Site Visit Requested/i
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

  await page.waitForLoadState('networkidle');

  // Click Contact Us first
  const contactBtn = page.getByText('Contact Us')

  await expect(contactBtn).toBeVisible({
    timeout: 10000
  });

  await contactBtn.click();

  await page.waitForTimeout(3000);

  // Look for WhatsApp link after popup opens
  const waLink = page.locator(
    'a[href*="wa.me"], a[href*="whatsapp"], a[href*="api.whatsapp.com"]'
  ).first();

  await expect(waLink).toBeVisible({
    timeout: 10000
  });

  await waLink.click();

  await page.waitForTimeout(5000);

  const status = await getStatusFromWhatsApp(
    microsite
  );

  console.log(
    '\n===== ALERT_02 STATUS RESPONSE ====='
  );
  console.log(status);
  console.log(
    '===================================\n'
  );

  expect(status.length)
    .toBeGreaterThan(0);
});
  // ====================================================
  // ALERT 3 - URL SHARED
  // ====================================================

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

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  await context.close();

  const status = await getStatusFromWhatsApp(
    microsite
  );

  console.log('\n===== ALERT_03 STATUS RESPONSE =====');
  console.log(status);
  console.log('===================================\n');

  expect(status).toContain(
    'No meaningful engagement found'
  );
});

  // ====================================================
// ALERT 4 - 3+ MINUTES SPENT
// ====================================================

// ====================================================
// ALERT 4 - 3+ MINUTES SPENT
// ====================================================

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

  await page.waitForLoadState('networkidle');

  // Stay on page for > 3 minutes
  await page.waitForTimeout(220000); // 3m 40s

  const status = await getStatusFromWhatsApp(
    microsite
  );

  console.log('\n===== ALERT_04 STATUS RESPONSE =====');
  console.log(status);
  console.log('===================================\n');

  expect(status).toContain(
  'Buyer Checked Project Details'
);

expect(status).toMatch(
  /Total Time Spent - \d+m \d+s/i
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

    const status = await getStatusFromWhatsApp(microsite);

console.log('\n===== ALERT_05 STATUS RESPONSE =====');
console.log(status);
console.log('===================================\n');

expect(status).toBe(
  'microsite_status_no_quote'
);
    });
  test('ALERT_06 - No Meaningful Engagement', async ({
  request
}) => {

  const microsite = await createMicrosite(
    request,
    'DEFAULT'
  );

  // Wait for backend processing
  await new Promise(resolve =>
    setTimeout(resolve, 10000)
  );

  const status =
    await getStatusFromWhatsApp(
      microsite
    );

  console.log(
    '\n===== ALERT_06 STATUS RESPONSE ====='
  );
  console.log(status);
  console.log(
    '===================================\n'
  );

  expect(status.length)
    .toBeGreaterThan(0);
});
});