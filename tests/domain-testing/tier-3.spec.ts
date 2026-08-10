import {
  test,
  expect,
  APIRequestContext,
  Page
} from '@playwright/test';

const LOGIN_URL =
  'https://dev.propfocus.in/login';

const API_URL =
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE: '9999999999',
} as const;

const OTP = '123456';

// Project the tier broker's org can actually access (override via env).
const TEST_PROJECT =
  process.env.TIER_TEST_PROJECT ?? 'Abhee Tranquila';
const PROJECT_MARKER =
  TEST_PROJECT.split(' ')[0];

// Tier 3 = CUSTOM_DOMAIN: branded host + bare token path. The custom host is
// org-specific (override via env); the token is `{buyername}-{HASH}`.
const TIER3_CUSTOM_HOST =
  process.env.TIER3_CUSTOM_HOST ?? 'discover.n8npropfocus.com';
const TIER3_URL_RE = new RegExp(
  `^https:\\/\\/${TIER3_CUSTOM_HOST.replace(/[.]/g, '\\.')}\\/[^/]+$`
);

async function login(
  page: Page,
  phone: string = PHONE.ACTIVE
) {

  await page.goto(LOGIN_URL);

  await page.waitForLoadState(
    'networkidle'
  );

  await page
    .locator(
      'input[type="tel"], input[placeholder*="phone" i]'
    )
    .fill(phone);

  await page
    .getByRole('button', {
      name: 'Send OTP'
    })
    .click();

  await page
    .locator(
      'input[placeholder="000000"], input[maxlength="6"]'
    )
    .fill(OTP);

  await page
    .getByRole('button', {
      name: 'Verify & Sign In'
    })
    .click();

  await page.waitForURL(
    /dashboard/,
    {
      timeout: 15000
    }
  );

  console.log(
    `Logged in as ${phone} ✓`
  );
}

function uniqueBuyerId() {

  const timestamp =
    Date.now().toString().slice(-4);

  const random =
    Math.floor(
      100 + Math.random() * 900
    );

  return `${timestamp}${random}`;
}

interface MicrositeResponseBody {
  success: boolean;
  micrositeUrl: string | null;
  buyerid?: string;
  message: string;
}

async function sendMicrositeRequest(
  request: APIRequestContext,
  messageBody: string
) {

  const response =
    await request.post(
      API_URL,
      {
        data: {
          event: 'message',
          data: {
            from: PHONE.ACTIVE,
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

let buyerId = '';
let micrositeUrl = '';

test.describe.serial(
  'Tier 3 Routing',
  () => {

    test(
      'TIER3_01 - Generate Microsite',
      async ({ request }) => {

        buyerId =
          uniqueBuyerId();

        const responseBody:
          MicrositeResponseBody =
            await sendMicrositeRequest(
              request,
              `Arhan with ID ${buyerId} for ${TEST_PROJECT}`
            );

        // A `success: true` response can still carry NO link (e.g.
        // "permission denied" / "clarification request"). Assert the link
        // actually exists AND matches the Tier 3 URL shape right here, so the
        // serial block fails fast with the real reason instead of passing hollow.
        expect(
          responseBody.success,
          `webhook not successful: ${responseBody.message}`
        ).toBeTruthy();

        expect(
          responseBody.micrositeUrl,
          `no micrositeUrl returned (message: ${responseBody.message})`
        ).toBeTruthy();

        micrositeUrl =
          responseBody.micrositeUrl!;

        expect(micrositeUrl).toMatch(TIER3_URL_RE);

        console.log(
          `Buyer ID: ${buyerId}`
        );

        console.log(
          `Microsite URL: ${micrositeUrl}`
        );

      }
    );

    test(
      'TIER3_02 - Verify Tier 3 URL Format',
      async () => {

        expect(
          micrositeUrl
        ).toMatch(TIER3_URL_RE);

        console.log(
          'Tier 3 URL format validated ✓'
        );

      }
    );

    test(
      'TIER3_03 - Microsite Opens Successfully',
      async ({ page }) => {

        await page.goto(
          micrositeUrl
        );

        await expect(
          page.locator('body')
        ).toBeVisible();

      }
    );

    test(
      'TIER3_04 - Project Loads',
      async ({ page }) => {

        await page.goto(
          micrositeUrl
        );

        await expect(
          page.locator('body')
        ).toContainText(
          PROJECT_MARKER
        );

      }
    );

    test(
  'TIER3_05 - Lead Appears In All Leads',
  async ({ page }) => {

    await login(page);

    await page.getByRole('button', {
      name: 'All Leads'
    }).click();

    const search =
      page.locator(
        'input[placeholder*="buyer ID"]'
      );

    await expect(search).toBeVisible({
      timeout: 15000
    });

    await search.fill(
      buyerId
    );

    // Wait for search results to update
    await page.waitForTimeout(3000);

    await expect(
      page.locator('tbody')
    ).toContainText(
      buyerId
    );

    console.log(
      `Buyer ${buyerId} found in All Leads ✓`
    );

  }
);
  

//   test(
//   'TIER3_06 - Visit Tracking Reflected',
//   async ({ page }) => {

//     // Generate visit
//     await page.goto(
//       micrositeUrl
//     );

//     await page.waitForLoadState(
//       'networkidle'
//     );

//     await page.waitForTimeout(
//       10000
//     );

//     // Login
//     await login(page);

//     // Open All Leads
//     await page.getByRole('button', {
//       name: 'All Leads'
//     }).click();

//     // Search Buyer ID
//     const search =
//       page.locator(
//         'input[placeholder*="buyer ID"]'
//       );

//     await expect(
//       search
//     ).toBeVisible({
//       timeout: 15000
//     });

//     await search.fill(
//       buyerId
//     );

//     await page.waitForTimeout(
//       3000
//     );

//     // Find lead row
//     const leadRow =
//       page.locator('tbody tr').filter({
//         hasText: buyerId
//       });

//     await expect(
//       leadRow
//     ).toBeVisible({
//       timeout: 20000
//     });

//     // Click Buyer Name column
//     await leadRow
//       .locator('td')
//       .nth(2)
//       .click();

//     // Verify modal
//     await expect(
//       page.getByText(
//         'Engagement Summary'
//       )
//     ).toBeVisible();

//     await expect(
//       page.getByText(
//         'Activity Timeline'
//       )
//     ).toBeVisible();

//     await expect(
//       page.locator('span').filter({
//         hasText: 'Total Visits'
//       })
//     ).toBeVisible();

//     await expect(
//       page.getByText(
//         /Session/i
//       )
//     ).toBeVisible();

//     console.log(
//       'Visit tracking reflected successfully ✓'
//     );

//   }
// );
 

//   test(
//   'TIER3_07 - Project Details View Tracked',
//   async ({ page }) => {

//     await page.goto(micrositeUrl);

//     await page.waitForLoadState(
//       'networkidle'
//     );

//     await page
//       .getByRole('button', {
//         name: /View Details/i
//       })
//       .click();
//       await page.waitForLoadState(
//   'networkidle'
// );

//     await page.waitForTimeout(
//       10000
//     );

//     await login(page);

//     await page.getByRole('button', {
//       name: 'All Leads'
//     }).click();

//     const search =
//       page.locator(
//         'input[placeholder*="buyer ID"]'
//       );

//     await search.fill(
//       buyerId
//     );

//     const leadRow =
//       page.locator('tbody tr').filter({
//         hasText: buyerId
//       });

//     await expect(
//       leadRow
//     ).toBeVisible();

//     await expect(
//       leadRow
//     ).toContainText(
//       'Project Details Viewed'
//     );

//     console.log(
//       'Project Details Viewed tracked ✓'
//     );

//   }
// );

test(
  'TIER3_08 - Visit Count Tracked',
  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await page.waitForTimeout(
      5000
    );

    await login(page);

    await page.getByRole('button', {
      name: 'All Leads'
    }).click();

    const search =
      page.locator(
        'input[placeholder*="buyer ID"]'
      );

    await search.fill(
      buyerId
    );

    await page.waitForTimeout(
      3000
    );

    const leadRow =
      page.locator('tbody tr').filter({
        hasText: buyerId
      });

    await expect(
      leadRow
    ).toBeVisible();

    const totalVisitsCell =
      leadRow.locator('td').nth(5);

    const visits =
      await totalVisitsCell.textContent();

    console.log(
      `Total Visits: ${visits}`
    );

    expect(
      Number(visits?.trim())
    ).toBeGreaterThanOrEqual(1);

    console.log(
      'Visit tracking verified ✓'
    );

  }

);
test(
  'TIER3_09 - Invalid Tier 3 URL Returns Error',
  async ({ page }) => {

    const invalidUrl =
      micrositeUrl.slice(0, -1) + 'X';

    await page.goto(
      invalidUrl,
      {
        waitUntil: 'networkidle'
      }
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /not found|microsite|invalid/i
    );

    console.log(
      'Invalid URL handled correctly ✓'
    );

  }
);

test(
  'TIER3_10 - Microsite Accessible Without Login',
  async ({ browser }) => {

    const context =
      await browser.newContext();

    const page =
      await context.newPage();

    await page.goto(
      micrositeUrl
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Microsite accessible without login ✓'
    );

    await context.close();

  }
);
test(
  'TIER3_11 - Session Tracking Modal Opens',
  async ({ page }) => {

    await login(page);

    await page.getByRole('button', {
      name: 'All Leads'
    }).click();

    const search =
      page.locator(
        'input[placeholder*="buyer ID"]'
      );

    await expect(
      search
    ).toBeVisible({
      timeout: 15000
    });

    await search.fill(
      buyerId
    );

    await page.waitForTimeout(
      3000
    );

    const leadRow =
      page.locator('tbody tr').filter({
        hasText: buyerId
      });

    await expect(
      leadRow
    ).toBeVisible();

    // Open the engagement modal by clicking the buyer name.
    await leadRow
      .getByText('Arhan')
      .click();

    await expect(
      page.getByText(
        'Engagement Summary'
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        'Activity Timeline'
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        /Session 1/i
      )
    ).toBeVisible();

    console.log(
      'Session tracking modal opens ✓'
    );

  }
);
  });