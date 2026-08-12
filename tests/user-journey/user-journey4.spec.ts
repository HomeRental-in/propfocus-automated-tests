// UJ4_STEP_01 Generate Microsite With Flipbook

// UJ4_STEP_02 Open Microsite

// UJ4_STEP_03 Click View Brochure

// UJ4_STEP_04 Verify Flipbook Opens

// UJ4_STEP_05 Navigate Flipbook Pages

// UJ4_STEP_06 Verify Flipbook Event

// UJ4_STEP_07 Simulate Brochure Engagement Time

// UJ4_STEP_08 Verify Dashboard Content Engagement Metrics

// UJ4_STEP_09 Verify Request Live Inventory Event

// UJ4_STEP_10 Verify Lead Appears In Dashboard

// UJ4_STEP_11 Verify High Intent Status (if available)

import {
  test,
  expect,
  Page,
  APIRequestContext,
} from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';
test.setTimeout(
  600000
);
let micrositeUrl = '';
let buyerId = '';
const OTP = '123456';
const BUYER_NAME = 'Arhan';
const PROJECT_NAME = 'Abhee Tranquila';
const LOGIN_URL =
  'https://dev.propfocus.in/dashboard/login';
const PHONE = {
  MAIN: BROKER_PHONE.MAIN_BROKER,
  SUB: BROKER_PHONE.SUB_BROKER,
} as const;
async function sendMicrositeRequest(
  request: APIRequestContext,
  messageBody: string
) {

  const response =
    await request.post(
      'https://dev.propfocus.in/api/whatsapp-webhook',
      {
        data: {
          event: 'message',
          data: {
            from: PHONE.MAIN,
            body: messageBody
          }
        }
      }
    );

  expect(
    response.status()
  ).toBe(200);

  return await response.json();

}
test.describe.configure({
  mode: 'serial',
});
async function login(
  page: Page,
  phone: string = PHONE.MAIN
) {

  await page.goto(LOGIN_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  const phoneInput =
    page.locator(
      'input[type="tel"], input[placeholder*="phone" i]'
    );

  await expect(phoneInput)
    .toBeVisible({ timeout: 30000 });

  await phoneInput.fill(phone);

  await page
    .getByRole('button', {
      name: /send otp/i,
    })
    .click();

  await expect(
    page.getByText(
      'Enter Verification Code'
    )
  ).toBeVisible({
    timeout: 15000,
  });

  const otpInput =
    page.locator(
      'input[placeholder="000000"], input[maxlength="6"]'
    );

  await otpInput.fill(OTP);

  await page
    .getByRole('button', {
      name: /verify/i,
    })
    .click();

  await page.waitForURL(
    /dashboard/,
    {
      timeout: 30000,
    }
  );

}

test.beforeAll(

  async ({ request }) => {

    buyerId =
      `UJ4${Date.now()
        .toString()
        .slice(-6)}`;

    const responseBody =
      await sendMicrositeRequest(
        request,
        `${BUYER_NAME} with ID ${buyerId} for ${PROJECT_NAME}`
      );

    expect(
      responseBody.success
    ).toBe(true);

    micrositeUrl =
      responseBody.micrositeUrl;

    console.log(
      `Generated Microsite: ${micrositeUrl}`
    );

  }

);
test(
  'UJ4_STEP_01 - Generate Microsite With Flipbook',
  async () => {

    expect(
      micrositeUrl
    ).toContain(
      'propfocus'
    );

    console.log(
      `Microsite Ready: ${micrositeUrl}`
    );

  }
);
test(

  'UJ4_STEP_02 - Open Microsite',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.getByText(
        BUYER_NAME
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        PROJECT_NAME
      )
    ).toBeVisible();

    console.log(
      `Microsite opened: ${micrositeUrl}`
    );

    console.log(
      'Buyer verified ✓'
    );

    console.log(
      'Project verified ✓'
    );

  }

);
test(
  'UJ4_STEP_03 - Click View Brochure',
  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const brochureBtn =
      page.getByRole('button', {
        name: /view brochure/i
      });

    await expect(
      brochureBtn
    ).toBeVisible();

    await brochureBtn.click();

    console.log(
      'View Brochure clicked ✓'
    );

  }
);
test(
  'UJ4_STEP_04 - Verify Flipbook Opens In New Tab',
  async ({ page }) => {

    await page.goto(micrositeUrl);

    const [flipbookPage] =
      await Promise.all([

        page.context().waitForEvent(
          'page'
        ),

        page
          .getByRole('button', {
            name: /view brochure/i
          })
          .click()

      ]);

    await flipbookPage.waitForLoadState();

    console.log(
      `Flipbook URL: ${flipbookPage.url()}`
    );

    expect(
      flipbookPage.url()
    ).not.toBe('');

    await expect(
      flipbookPage.locator('body')
    ).toBeVisible();

  }
);

test(
  'UJ4_STEP_05 - Verify Brochure Pages Loaded',
  async ({ page }) => {

    await page.goto(micrositeUrl);

    const [flipbookPage] =
      await Promise.all([

        page.context().waitForEvent(
          'page'
        ),

        page
          .getByRole('button', {
            name: /view brochure/i
          })
          .click()

      ]);

    await flipbookPage.waitForLoadState();

    // Verify page numbers exist
    const pageNumbers =
      flipbookPage.locator(
        'text=/\\d+/'
      );

    const count =
      await pageNumbers.count();

    console.log(
      `Page markers found: ${count}`
    );

    expect(count)
      .toBeGreaterThan(0);

    console.log(
      'Brochure pages loaded ✓'
    );

  }
);
test(
  'UJ4_STEP_06 - Simulate Brochure Engagement Duration',
  async ({ page }) => {

    await page.goto(micrositeUrl);

    const [flipbookPage] =
      await Promise.all([
        page.context().waitForEvent('page'),
        page.getByRole('button', {
          name: /view brochure/i
        }).click()
      ]);

    await flipbookPage.waitForLoadState();

    console.log(
      'Starting 5 minute brochure engagement...'
    );

    await flipbookPage.waitForTimeout(
      300000 // 5 minutes
    );

    console.log(
      '5 minute engagement completed ✓'
    );

  }
);


test(
  'UJ4_STEP_07 - Verify Dashboard Engagement Metrics',
  async ({ page }) => {

    await login(page);

    await page
      .getByText(
        'All Leads',
        { exact: true }
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(2000);

    const leadRow =
      page.locator(
        'table tbody tr'
      ).first();

    await expect(
      leadRow
    ).toBeVisible();

    await leadRow.click();

    await expect(
      page.getByText(
        'Engagement Summary'
      )
    ).toBeVisible();

    console.log(
      'Dashboard engagement metrics visible ✓'
    );

  }
);

test(
  'UJ4_STEP_08 - Click Request Live Inventory',
  async ({ page }) => {

    await page.goto(micrositeUrl);
    // Click View Details first
await page
  .getByRole('button', {
    name: /view details/i
  })
  .first()
  .click();

    const [newPage] =
      await Promise.all([

        page.context().waitForEvent(
          'page'
        ),

        page
          .getByRole('button', {
            name: /request live inventory/i
          })
          .click()

      ]);

    // Don't wait for full load
    await newPage.waitForTimeout(
      3000
    );

    const openedUrl =
      newPage.url();

    console.log(
      `Opened URL: ${openedUrl}`
    );

    expect(
      openedUrl
    ).not.toBe('');

    console.log(
      'Request Live Inventory opened successfully ✓'
    );

  }
);

test(
  'UJ4_STEP_09 - Verify Inventory Request Event',
  async ({ page }) => {

    let eventCaptured = false;

    page.on(
      'response',
      async response => {

        try {

          const body =
            await response.json();

          if (
            body.eventType ===
            'contact_wa_call'
          ) {

            eventCaptured = true;

            console.log(
              'Inventory event captured ✓'
            );

          }

        } catch {}

      }
    );

    await page.goto(micrositeUrl);

    await page
      .getByRole('button', {
        name: /request live inventory/i
      })
      .click();

    await page.waitForTimeout(
      5000
    );

    expect(
      eventCaptured
    ).toBeTruthy();

  }
);

test(
  'UJ4_STEP_10 - Verify Lead Appears In Dashboard',
  async ({ page }) => {

    await login(page);

    await page
      .getByText(
        'All Leads',
        { exact: true }
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(
      2000
    );

    const leadRow =
      page.locator(
        'table tbody tr'
      ).first();

    await expect(
      leadRow
    ).toBeVisible();

    console.log(
      `Lead ${buyerId} found ✓`
    );

  }
);

test(
  'UJ4_STEP_11 - Verify High Intent Qualification',
  async ({ page }) => {

    await login(page);

    await page
      .getByText(
        'All Leads',
        { exact: true }
      )
      .click();

    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(2000);

    const leadRow =
      page.locator(
        'table tbody tr'
      )
      .first();

    await expect(
      leadRow
    ).toBeVisible();

    await leadRow.click();

    await expect(
      page.getByText(
        /3\+\s*visits/i
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        /5\+\s*time spend/i
      )
    ).toBeVisible();

    console.log(
      'High Intent qualification visible ✓'
    );

  }
);