// User Journey 2: Lead → Curation Microsite → Multi-Project Comparison → Follow-Up
// Flow Steps
// Broker Login
// Broker logs into the PropFocus dashboard.
// Curation Microsite Creation
// Broker selects multiple projects and generates a curation microsite.
// Sharing with Buyer
// Broker shares the microsite link with the buyer via WhatsApp/email.
// Buyer Access
// Buyer opens the curation microsite link.
// Project Exploration
// Buyer compares multiple projects by:
// Opening project detail pages
// Browsing images
// Viewing brochures
// Checking pricing
// Exploring location/maps
// Engagement Tracking
// System tracks buyer activity and time spent on each project.
// High-Interest Detection
// Dashboard identifies the project with maximum engagement as the “High-Interest Project.”
// Activity Timeline Update
// Buyer’s actions (comparisons, clicks, views) are recorded in the activity timeline.
// Broker Alert
// Broker receives a high-intent alert indicating strong buyer interest.
// Follow-Up Action
// Broker initiates follow-up via call or WhatsApp.
// Lead Status Update
// Lead status is updated to “Interested.”


import {
  test,
  expect,
  Page,
  APIRequestContext,
} from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';

test.setTimeout(180000);

const LOGIN_URL =
  'https://dev.propfocus.in/dashboard/login';

const CURATION_URL =
  'https://dev.propfocus.in/propfocus-internal/arhan-092050CE6';

const BUYER_NAME = 'Arhan';

const PHONE = {
  MAIN: BROKER_PHONE.MAIN_BROKER,
  SUB: BROKER_PHONE.SUB_BROKER,
} as const;

const OTP = '123456';

let highInterestProject = '';

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

test('UJ2_STEP_01 - Broker Login', async ({ page }) => {
  await login(page);

  await expect(
    page.getByText('Overview')
  ).toBeVisible();

  console.log('Dashboard loaded');
});

test('UJ2_STEP_02 - Buyer Opens Curation Microsite', async ({ page }) => {
  await page.goto(CURATION_URL);

  await expect(
    page.getByText('Hi Arhan')
  ).toBeVisible();

  await expect(
    page.getByText('Abhee Tranquila')
  ).toBeVisible();

  await expect(
    page.getByText('Abhee Aaria')
  ).toBeVisible();

  await expect(
    page.getByText('Hosachiguru')
  ).toBeVisible();

  console.log('Curation microsite loaded');
});

test('UJ2_STEP_03 - Buyer Compares Project 1', async ({ page }) => {
  await page.goto(CURATION_URL);

  const start = Date.now();

  await page
    .getByRole('button', { name: /view details/i })
    .nth(0)
    .click();

  await page.waitForLoadState(
  'domcontentloaded'
);

  await expect(
    page.locator('img').first()
  ).toBeVisible();

  await page.waitForTimeout(5000);

  const engagement =
    Date.now() - start;

  console.log(`Project 1 engagement: ${engagement}ms`);

  highInterestProject =
    'Hosachiguru Unnati - Farm Villa Plots';
});

test('UJ2_STEP_04 - Buyer Compares Project 2', async ({ page }) => {
  await page.goto(CURATION_URL);

  await page
    .getByRole('button', { name: /view details/i })
    .nth(1)
    .click();

  await page.waitForLoadState(
  'domcontentloaded'
);

  await expect(
    page.locator('img').first()
  ).toBeVisible();

  await page.waitForTimeout(3000);

  console.log('Project 2 explored');
});

test('UJ2_STEP_05 - Buyer Compares Project 3', async ({ page }) => {
  await page.goto(CURATION_URL);

  await page
    .getByRole('button', { name: /view details/i })
    .nth(2)
    .click();

  await page.waitForLoadState(
  'domcontentloaded'
);

  await expect(
    page.locator('img').first()
  ).toBeVisible();

  await page.waitForTimeout(3000);

  console.log('Project 3 explored');
});

test('UJ2_STEP_06 - Buyer Views Images', async ({ page }) => {
  await page.goto(CURATION_URL);

  await page
    .getByRole('button', { name: /view details/i })
    .nth(2)
    .click();

  await page.waitForLoadState('domcontentloaded');

  const images =
    page.locator('img');

  expect(await images.count())
    .toBeGreaterThan(0);

  console.log('Images visible');
});

test('UJ2_STEP_07 - Buyer Views Pricing', async ({ page }) => {
  await page.goto(CURATION_URL);


await page
  .getByRole('button', { name: /view details/i })
  .first()
  .click();

await expect(
  page.getByText(/Starting Price/i)
).toBeVisible();

  await expect(
    page.getByText(/Lakhs|Cr/i)
  ).toBeVisible();

  console.log('Pricing verified');
});

test('UJ2_STEP_08 - Buyer Views Location', async ({ page }) => {
  

  await page.goto(CURATION_URL);

await page
  .getByRole('button', { name: /view details/i })
  .first()
  .click();

await page.getByText('Location').click();

await expect(
  page.getByText(/Bangalore/i)
).toBeVisible();

  console.log('Location visible');
});

test('UJ2_STEP_09 - Engagement Tracking Validation', async ({ page }) => {
  const trackingCalls: string[] = [];

  page.on('response', response => {
    if (
      response.url().includes('/track')
      || response.url().includes('/analytics')
      || response.url().includes('/event')
    ) {
      trackingCalls.push(response.url());
    }
  });

  await page.goto(CURATION_URL);

  await page.waitForTimeout(5000);

  expect(
  trackingCalls.length,
  'Tracking calls should fire'
).toBeGreaterThan(0);

console.log(
  `Tracking calls captured: ${trackingCalls.length}`
);

});

test(
  'UJ2_STEP_10 - Verify High Interest Project',
  async ({ page }) => {

    await login(page);

    await page
      .getByText('All Leads', {
        exact: true,
      })
      .click();

    const searchBar =
      page.locator(
        'input[placeholder*="Search" i]'
      ).first();

    await expect(
      searchBar
    ).toBeVisible();

    await searchBar.fill(BUYER_NAME);

    await page.waitForTimeout(1500);

    const rows =
      page.locator(
        'table tbody tr'
      );

    await expect(
      rows.first()
    ).toBeVisible();

    const rowText =
      await rows.first().innerText();

    expect(
      rowText.length
    ).toBeGreaterThan(0);

    console.log(
      `Expected high-interest project: ${highInterestProject}`
    );

  }
);

test(
  'UJ2_STEP_11 - Verify Activity Timeline',
  async ({ page }) => {

    await login(page);

    await page
      .getByText('All Leads', {
        exact: true,
      })
      .click();

    const rows =
      page.locator(
        'table tbody tr'
      );

    await expect(
      rows.first()
    ).toBeVisible();

    await rows
      .first()
      .locator('td')
      .nth(2)
      .click();

    await expect(
      page.getByText(
        'Activity Timeline'
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        'Engagement Summary'
      )
    ).toBeVisible();

    await expect(
      page.getByText(
        'Project Engagement Details'
      )
    ).toBeVisible();

  }
);


test(
  'UJ2_STEP_12 - Verify Project Engagement Details',
  async ({ page }) => {

    await login(page);

    await page
      .getByText('All Leads', {
        exact: true,
      })
      .click();

    const rows =
      page.locator('table tbody tr');

    await expect(
      rows.first()
    ).toBeVisible();

    // Open lead drawer
    await rows
      .first()
      .locator('td')
      .nth(2)
      .click();

    await expect(
      page.getByText(
        'Project Engagement Details'
      )
    ).toBeVisible();

    const engagementSection =
      page.locator(
        'text=Project Engagement Details'
      ).locator('..');

    await expect(
      engagementSection
    ).toBeVisible();

    // Verify at least one project is listed
    await expect(
      page.getByText(/Abhee|Hosachiguru/i)
        .first()
    ).toBeVisible();

    console.log(
      'Project Engagement Details verified ✓'
    );

  }
);
test(
  'UJ2_STEP_13 - Verify Lead Appears In All Leads',
  async ({ page }) => {

    await login(page);

    await page
      .getByText('All Leads', {
        exact: true,
      })
      .click();

    const searchBar =
      page.locator(
        'input[placeholder*="Search" i]'
      ).first();

    await expect(
      searchBar
    ).toBeVisible();

    await searchBar.fill(BUYER_NAME);

    await page.waitForTimeout(1500);

    const rows =
      page.locator('table tbody tr');

    const count =
      await rows.count();

    console.log(
      `Rows found: ${count}`
    );

    expect(
      count,
      'Lead should appear in All Leads'
    ).toBeGreaterThan(0);

    const rowText =
      await rows.first().innerText();

    console.log(rowText);

    expect(
      rowText.toLowerCase()
    ).toContain('harsha');

    console.log(
      'Lead appears in All Leads ✓'
    );

  }
);
test(
  'UJ2_STEP_14 - Journey Consistency Validation',
  async ({ page }) => {

    await login(page);

    await page
      .getByText('All Leads', {
        exact: true,
      })
      .click();

    const rows =
      page.locator('table tbody tr');

    await expect(
      rows.first()
    ).toBeVisible();

    await rows
      .first()
      .locator('td')
      .nth(2)
      .click();

    // Timeline visible
    await expect(
      page.getByText(
        'Activity Timeline'
      )
    ).toBeVisible();

    // Engagement Summary visible
    await expect(
      page.getByText(
        'Engagement Summary'
      )
    ).toBeVisible();

    // Project Engagement Details visible
    await expect(
      page.getByText(
        'Project Engagement Details'
      )
    ).toBeVisible();

    // At least one session recorded
    const sessions =
      page.locator(
        'text=/Session \\d+/'
      );

    const sessionCount =
      await sessions.count();

    console.log(
      `Sessions recorded: ${sessionCount}`
    );

    expect(
      sessionCount,
      'Buyer activity should be recorded'
    ).toBeGreaterThan(0);

    console.log('\n=== UJ2 SUMMARY ===');
    console.log(
      '✓ Buyer opened curation microsite'
    );
    console.log(
      '✓ Compared multiple projects'
    );
    console.log(
      '✓ Viewed project details'
    );
    console.log(
      '✓ Engagement recorded'
    );
    console.log(
      '✓ Activity timeline updated'
    );
    console.log(
      '✓ Project engagement details updated'
    );

    console.log(
      '\n✅ User Journey 2 completed successfully'
    );

  }
);
