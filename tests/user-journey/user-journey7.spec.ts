import {
  test,
  expect,
  Page
} from '@playwright/test';


import { BROKER_PHONE } from '../../utils/brokerPhones';

const SUB_BROKER_PHONE = BROKER_PHONE.SUB_BROKER;
const OTP = '123456';
// Mock IDs for leads that belong to a Main Broker and another Sub Broker

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

test.describe('Sub Broker Role-Based Access Restrictions (RBAC)', () => {
  // Use serial mode so that tests can reuse context easily if needed, matching UJ6 structure
  test.setTimeout(120000);

  test('UJ7_STEP_01 - Sub Broker Logs Into Dashboard', async ({ page }) => {
    await login(page, SUB_BROKER_PHONE);

    await expect(page.getByRole('button', { name: 'All Leads' })).toBeVisible();
    console.log('Sub Broker successfully logged in ✓');
  });

  test('UJ7_STEP_02 - Verify Restricted Navigation Items Hidden', async ({ page }) => {
  await login(page, SUB_BROKER_PHONE);

  await expect(
    page.getByText(/admin|settings|team management|broker management/i)
  ).toHaveCount(0);

  console.log(
    'Restricted navigation items are hidden ✓'
  );
});
  test('UJ7_STEP_03 - Verify Admin Routes Not Accessible', async ({ page }) => {
  await login(page, SUB_BROKER_PHONE);

  await page.goto(
    'https://dev.propfocus.in/dashboard/admin'
  );

  await page.waitForLoadState(
    'networkidle'
  );

  const currentUrl = page.url();

  expect(
    currentUrl.includes('/admin')
  ).toBeFalsy();

  console.log(
    'Admin routes are inaccessible ✓'
  );
});

  test('UJ7_STEP_04 - Verify Higher-Level Analytics Hidden', async ({ page }) => {
  await login(page, SUB_BROKER_PHONE);

  await expect(
    page.locator('body')
  ).not.toContainText(
    /team performance|organization analytics|all brokers|revenue summary/i
  );

  console.log(
    'Higher-level analytics are hidden ✓'
  );
});

  test('UJ7_STEP_05 - Verify Main Broker Management Features Hidden', async ({ page }) => {
  await login(page, SUB_BROKER_PHONE);

  await expect(
    page.locator('body')
  ).not.toContainText(
    /assign broker|manage brokers|broker permissions|broker settings/i
  );

  console.log(
    'Main broker management features are hidden ✓'
  );
});

  test('UJ7_STEP_06 - Verify Unauthorized Access Attempts Are Blocked Properly', async ({ page }) => {
    await login(page, SUB_BROKER_PHONE);

    // Attempt direct URL navigation to a theoretically restricted route like `/team` or `/admin`
    const adminUrl = 'https://dev.propfocus.in/dashboard/admin';
    await page.goto(adminUrl);
    await page.waitForLoadState('networkidle');
    
    // Evaluate RBAC fallback handling:
    // It should either redirect to safe dashboard base URL, or show an unauthorized/404 state screen
    const currentUrl = page.url();
    const isRedirectedSafely = !currentUrl.includes('/admin') || currentUrl === 'https://dev.propfocus.in/dashboard';
    const showsUnauthorizedErrorMsg = await page.getByText(/Unauthorized|Access Denied|Page Not Found|404|Forbidden/i).isVisible().catch(() => false);
    
    expect(isRedirectedSafely || showsUnauthorizedErrorMsg).toBeTruthy();
    
    console.log('Unauthorized direct URL access logically blocked/redirected ✓');
  });
});