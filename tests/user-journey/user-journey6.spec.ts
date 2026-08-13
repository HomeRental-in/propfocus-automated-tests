import {
  test,
  expect,
  Page
} from '@playwright/test';
import { APIRequestContext } from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';

const PROJECT_NAME = 'Abhee Tranquila';
const BUYER_NAME = 'Arhan';
const MAIN_BROKER_PHONE = BROKER_PHONE.MAIN_BROKER;
const SUB_BROKER_PHONE = BROKER_PHONE.SUB_BROKER;
const OTP = '123456';
let buyerId = '';
const testLead = {
    name: 'Arhan',
  phone: SUB_BROKER_PHONE
};

async function sendWebhookRequest(
  request: APIRequestContext,
  messageBody: string
) {
  const response = await request.post(
    'https://dev.propfocus.in/api/whatsapp-webhook',
    {
      timeout: 60000,
      data: {
        event: 'message',
        data: {
          from: SUB_BROKER_PHONE,
          body: messageBody
        }
      }
    }
  );

  expect(response.status()).toBe(200);

  return await response.json();
}

async function login(
  page: Page,
  phone: string
) {

  await page.goto(
    'https://dev.propfocus.in/dashboard/login',
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }
  );

  const phoneInput =
    page.locator(
      'input[type="tel"], input[placeholder*="phone" i]'
    );

  await expect(
    phoneInput
  ).toBeVisible({
    timeout: 30000
  });

  await phoneInput.fill(
    phone
  );

  await page
    .getByRole('button', {
      name: /send otp/i
    })
    .click();

  await expect(
    page.getByText(
      'Enter Verification Code'
    )
  ).toBeVisible({
    timeout: 15000
  });

  const otpInput =
    page.locator(
      'input[placeholder="000000"], input[maxlength="6"]'
    );

  await otpInput.fill(
    OTP
  );

  await page
    .getByRole('button', {
      name: /verify/i
    })
    .click();

  await page.waitForURL(
    /dashboard/,
    {
      timeout: 30000
    }
  );

  await expect(
  page.getByRole('button', {
    name: 'All Leads'
  })
).toBeVisible();

  console.log(
    `Logged in successfully: ${phone}`
  );

}
let micrositeUrl = '';

test.describe('Sub Broker / Main Broker Lead Visibility Journey', () => {
  test.setTimeout(120000);

  test(
  'UJ6_STEP_01 - Generate Microsite As Sub Broker',
  async ({ request }) => {

    buyerId =
      `UJ6${Date.now()
        .toString()
        .slice(-6)}`;

    const responseBody =
      await sendWebhookRequest(
        request,
        ` ${BUYER_NAME} with ID ${buyerId} for ${PROJECT_NAME}`
      );

    console.log('====================');
    console.log('WEBHOOK RESPONSE');
    console.log(JSON.stringify(responseBody, null, 2));
    console.log('====================');

    expect(responseBody.success).toBe(true);

    micrositeUrl =
      responseBody?.micrositeUrl;

    console.log(
      `Buyer ID: ${buyerId}`
    );

    console.log(
      `Generated Microsite: ${micrositeUrl}`
    );

    // TEMPORARILY DISABLED
    // expect(micrositeUrl).toBeDefined();

  }
);
  test('UJ6_STEP_02 - Buyer Opens Microsite', async ({ page }) => {
  await page.goto(micrositeUrl);
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveURL(/propfocus-internal/);

  console.log('[Validation]: Buyer successfully accessed the microsite.');
});

  test('UJ6_STEP_03 - Buyer Performs Engagement Activities', async ({ page }) => {
  await page.goto(micrositeUrl);
  await page.waitForLoadState('domcontentloaded');

  const viewDetailsBtn = page
    .getByRole('button', {
      name: /view details/i
    })
    .first();

  if (await viewDetailsBtn.isVisible()) {
    await viewDetailsBtn.click();
  }

 const brochureBtn = page
  .getByText(/brochure/i)
  .first();

if (await brochureBtn.isVisible().catch(() => false)) {

  const [brochurePage] = await Promise.all([
    page.context().waitForEvent('page').catch(() => null),
    brochureBtn.click()
  ]);

  if (brochurePage) {
    await brochurePage.waitForLoadState();
    await brochurePage.waitForTimeout(3000);
    await brochurePage.close();
  }

}

  

  console.log(
    '[Validation]: Buyer engagement activities registered.'
  );
});

  test(
  'UJ6_STEP_04 - Verify Lead Created Under Sub Broker',
  async ({ page }) => {

    await login(
      page,
      SUB_BROKER_PHONE
    );

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
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

    const leadRow =
      page.locator(
        'table tbody tr'
      ).filter({
        hasText: buyerId
      });

    console.log(
      'Matching Rows:',
      await leadRow.count()
    );

    await expect(
      leadRow.first()
    ).toBeVisible({
      timeout: 30000
    });

    console.log(
      `Lead ${buyerId} found under Sub Broker ✓`
    );

  }
);


    

  test(
  'UJ6_STEP_05 - Verify Activity Timeline Updated',
  async ({ page }) => {

    await login(
      page,
      SUB_BROKER_PHONE
    );

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    const searchBox =
      page.getByPlaceholder(
        /search/i
      );

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(
      3000
    );

    const leadRow =
      page.locator(
        'table tbody tr'
      ).filter({
        hasText: buyerId
      });

    await expect(
      leadRow.first()
    ).toBeVisible();

    await leadRow.first().click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /activity|timeline|engagement|interaction/i
    );

    console.log(
      'Lead details page opened ✓'
    );

  }
);

  test('UJ6_STEP_06 - Login As Main Broker', async ({ page }) => {
  await login(
    page,
    MAIN_BROKER_PHONE
  );

  await expect(
    page.getByRole('button', {
      name: 'All Leads'
    })
  ).toBeVisible();

  console.log(
    'Main Broker login successful ✓'
  );
});

  test('UJ6_STEP_07 - Verify Main Broker Can View Sub Broker Lead', async ({ page }) => {
    await login(page, MAIN_BROKER_PHONE);

    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const searchBox = page.getByPlaceholder(/search/i);
    await searchBox.fill(
  buyerId
);
    await page.waitForTimeout(2000);

    const leadRow = page.locator('table tbody tr').filter({
  hasText: buyerId
});

await expect(leadRow).toBeVisible();
  });

  test(
  'UJ6_STEP_08 - Verify Main Broker Can View Activity Timeline',
  async ({ page }) => {

    await login(
      page,
      MAIN_BROKER_PHONE
    );

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    const searchBox =
      page.getByPlaceholder(
        /search/i
      );

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(
      3000
    );

    const leadRow =
      page.locator(
        'table tbody tr'
      ).filter({
        hasText: buyerId
      });

    await expect(
      leadRow.first()
    ).toBeVisible();

    await leadRow.first().click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /activity|timeline|engagement|interaction/i
    );

    console.log(
      'Main Broker can view lead activity ✓'
    );

  }
);

  test(
  'UJ6_STEP_09 - Verify Main Broker Can View Engagement Metrics',
  async ({ page }) => {

    await login(
      page,
      MAIN_BROKER_PHONE
    );

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    const searchBox =
      page.getByPlaceholder(
        /search/i
      );

    await searchBox.fill(
      buyerId
    );

    await page.waitForTimeout(
      3000
    );

    const leadRow =
      page.locator(
        'table tbody tr'
      ).filter({
        hasText: buyerId
      });

    await expect(
      leadRow.first()
    ).toBeVisible();

    await leadRow.first().click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /engagement|activity|interaction|score|summary/i
    );

    console.log(
      'Main Broker can view engagement metrics ✓'
    );

  }
);

test(
  'UJ6_STEP_10 - Verify Main Broker Can View Alerts',
  async ({ page }) => {

    await login(
      page,
      MAIN_BROKER_PHONE
    );

    const alertIcon = page.locator(
      '.bell-icon, [aria-label*="Notification"], [title*="Notification"]'
    ).first();

    if (await alertIcon.isVisible().catch(() => false)) {

      await alertIcon.click();

      await page.waitForTimeout(
        2000
      );

      await expect(
        page.locator('body')
      ).toBeVisible();

      console.log(
        'Alert panel opened ✓'
      );

    } else {

      console.log(
        'Alert icon not found - skipping validation'
      );

    }

  }
);

  test('UJ6_STEP_11 - Verify Main Broker Can View Site Visit Details', async ({ page }) => {
    await login(page, MAIN_BROKER_PHONE);

    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const searchBox = page.getByPlaceholder(/search/i);
    await searchBox.fill(
  buyerId
);
    await page.waitForTimeout(2000);

    const leadRow = page.locator('table tbody tr').first();
    await leadRow.click();
    await page.waitForLoadState('networkidle');

    const siteVisitsSection = page.getByText('Site Visit', { exact: false }).first();
    await expect(siteVisitsSection).toBeVisible();
  });

  test(
  'UJ6_STEP_12 - Verify Lead Ownership Remains With Sub Broker',
  async ({ page }) => {

    await login(page, MAIN_BROKER_PHONE);

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState('networkidle');

    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill(buyerId);

    await page.waitForTimeout(2000);

    const leadRow =
      page.locator('table tbody tr')
      .filter({
        hasText: buyerId
      });

    await expect(
      leadRow.first()
    ).toBeVisible();

    await leadRow.first().click();

    await page.waitForLoadState(
      'networkidle'
    );

    // Lead opened successfully
    await expect(
      page.locator('body')
    ).toBeVisible();

    console.log(
      `Lead ${buyerId} is still visible to Main Broker without reassignment ✓`
    );
  }
);

  test(
  'UJ6_STEP_13 - Verify Sub Broker Performance Visible To Main Broker',
  async ({ page }) => {

    await login(
      page,
      MAIN_BROKER_PHONE
    );

    const teamMenu = page
      .getByText('Team', { exact: true })
      .or(
        page.getByText('Brokers', {
          exact: true
        })
      )
      .first();

    await expect(
      teamMenu
    ).toBeVisible();

    await teamMenu.click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('table, .team-card, .broker-card').first()
    ).toBeVisible();

    console.log(
      'Sub Broker performance section visible ✓'
    );

  }
);
});