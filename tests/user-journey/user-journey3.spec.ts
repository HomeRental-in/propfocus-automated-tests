import {
  test,
  expect,
  Page,
  APIRequestContext,
} from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';

let micrositeUrl = '';
let buyerId = '';

const BUYER_NAME = 'Harsha';
const PROJECT_NAME = 'Abhee Tranquila';


const LOGIN_URL =
  'https://dev.propfocus.in/dashboard/login';
const PHONE = {
  MAIN: BROKER_PHONE.MAIN_BROKER,
  SUB: BROKER_PHONE.SUB_BROKER,
} as const;

const OTP = '123456';

let highInterestProject = '';
function uniqueBuyerId() {

  return `UJ3${Date.now()
    .toString()
    .slice(-6)}`;

}

async function sendMicrositeRequest(
  request: APIRequestContext,
  messageBody: string,
  phone: string = PHONE.SUB
) {

  const response =
    await request.post(
      'https://dev.propfocus.in/api/whatsapp-webhook',
      {
        data: {
          event: 'message',
          data: {
            from: phone,
            body: messageBody
          }
        }
      }
    );

  expect(response.status())
    .toBe(200);

  return await response.json();

}
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

  await expect(
    page.getByText(
      'Overview',
      { exact: false }
    )
  ).toBeVisible({
    timeout: 30000,
  });
}
test.beforeAll(

  async ({ request }) => {

    buyerId =
      uniqueBuyerId();

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
// ======================================================
// UJ3_STEP_01
// Buyer Opens Microsite First Time
// ======================================================

test(

  'UJ3_STEP_01 - Buyer Opens Microsite First Time',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState(
      'networkidle'
    );

    // Buyer name
    await expect(
      page.getByText(BUYER_NAME)
    ).toBeVisible();

    console.log(
      'Buyer name verified ✓'
    );

    // Project name
    await expect(
      page.getByText(PROJECT_NAME)
    ).toBeVisible();

    console.log(
      'Project name verified ✓'
    );

    // Builder branding
    await expect(
      page.getByText(/Abhee/i)
    ).toBeVisible();

    console.log(
      'Builder branding verified ✓'
    );

    console.log(
      'First visit completed ✓'
    );

  }

);

// ======================================================
// UJ3_STEP_02
// Buyer Exits Without Engagement
// ======================================================

test(

  'UJ3_STEP_02 - Buyer Exits Without Engagement',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    await page.goto('about:blank');

    console.log(
      'Buyer exited microsite'
    );

  }

);

// ======================================================
// UJ3_STEP_03
// Buyer Revisits Same Microsite
// ======================================================

test(

  'UJ3_STEP_03 - Buyer Revisits Same Microsite',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('body')
    ).toBeVisible();

    console.log(
      'Buyer revisited microsite'
    );

  }

);

// ======================================================
// UJ3_STEP_04
// Verify Revisited Link Event
// ======================================================

test(

  'UJ3_STEP_04 - Verify Revisited Link Event',

  async ({ page }) => {

    let revisitedFound = false;

    page.on('response', async response => {

      try {

        const body = await response.json();

        if (
          body.eventType === 'revisited_link'
        ) {

          revisitedFound = true;

          console.log(
            'revisited_link captured'
          );

        }

      } catch {}

    });

    await page.goto(micrositeUrl);

    await page.waitForTimeout(5000);

    expect(
      revisitedFound
    ).toBeTruthy();

  }

);

// ======================================================
// UJ3_STEP_05
// Verify Fresh Page View Event
// ======================================================

test(

  'UJ3_STEP_05 - Verify Fresh Page View Event',

  async ({ page }) => {

    let pageViewFound = false;

    page.on('response', async response => {

      try {

        const body = await response.json();

        if (
          body.eventType === 'page_view'
        ) {

          pageViewFound = true;

        }

      } catch {}

    });

    await page.goto(micrositeUrl);

    await page.waitForTimeout(5000);

    expect(
      pageViewFound
    ).toBeTruthy();

  }

);

test(
  'UJ3_STEP_06 - Verify Two Sessions Created',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    // Navigate to All Leads
    await page
      .getByText(
        'All Leads',
        { exact: true }
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    // Search generated lead
    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(2000);

    // Verify lead exists
    const leadRow =
      page.locator(
        'table tbody tr'
      ).first();

    await expect(
      leadRow
    ).toBeVisible();

    console.log(
      `Lead ${buyerId} found in dashboard ✓`
    );

    // Open lead drawer
    await leadRow.click();

    // Verify Activity Timeline
    await expect(
      page.getByText(
        'Activity Timeline'
      )
    ).toBeVisible();

    // Verify sessions
    const sessions =
      page.getByText(
        /Session\s+\d+/i
      );

    const sessionCount =
      await sessions.count();

    console.log(
      `Sessions found: ${sessionCount}`
    );

    expect(
      sessionCount
    ).toBeGreaterThanOrEqual(2);

    await expect(
      page.getByText(/Session 1/i)
    ).toBeVisible();

    await expect(
      page.getByText(/Session 2/i)
    ).toBeVisible();

    console.log(
      'Session 1 verified ✓'
    );

    console.log(
      'Session 2 verified ✓'
    );

    console.log(
      'Two sessions verified ✓'
    );

  }
);
test(
  'UJ3_STEP_07 - Verify Revisit Metrics Updated',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    // Navigate to All Leads
    await page
      .getByText(
        'All Leads',
        { exact: true }
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    // Search generated lead
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

console.log(
  `Lead ${buyerId} found in dashboard ✓`
);

await leadRow.click();

    // Verify Engagement Summary section
    await expect(
      page.getByText(
        'Engagement Summary'
      )
    ).toBeVisible();

    const visitsText =
      await page
        .locator('text=Total Visits')
        .locator('..')
        .textContent();

    console.log(
      `Visits Text: ${visitsText}`
    );

    expect(
      visitsText ?? ''
    ).toMatch(/2/);

    console.log(
      'Revisit metrics updated ✓'
    );

  }
);

test(
  'UJ3_STEP_08 - Verify Main Broker Can View Lead',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

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

    console.log(
      `Main broker can view lead: ${buyerId}`
    );

    console.log(
      'Main broker access verified ✓'
    );

  }
);
test(
  'UJ3_STEP_09 - Verify Sub Broker Restriction',
  async ({ page }) => {

    await login(page, PHONE.SUB);

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

    await page.waitForTimeout(3000);

    const rows =
      page.locator(
        'table tbody tr'
      );

    const rowCount =
      await rows.count();

    console.log(
      `Rows visible to sub broker: ${rowCount}`
    );

    expect(
      rowCount
    ).toBe(0);

    console.log(
      'Sub broker restriction verified ✓'
    );

  }
);