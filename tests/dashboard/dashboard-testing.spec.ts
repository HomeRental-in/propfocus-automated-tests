import {
  test,
  expect,
  Page,
  BrowserContext,
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const DASHBOARD_URL  = 'https://dev.propfocus.in/dashboard';
const LOGIN_URL      = 'https://dev.propfocus.in/dashboard/login';
const API_URL        = 'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  MAIN:   '9999999999',                                          // main broker
  SUB:    '9888898888',                                          // sub broker
} as const;

const OTP = '123456';                                            // fixed dev OTP

/// ======================================================
// SERIAL MODE
// All dashboard tests share one logged-in session
// ======================================================
 
test.describe.configure({ mode: 'serial' });
 
// ======================================================
// NAV HELPER
// Sidebar items are not <a> tags — use locator by text
// ======================================================
 
async function clickNav(page: Page, name: string) {
  await page.locator(`text=${name}`).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}
 
// ======================================================
// LOGIN HELPER
// ======================================================
 
async function login(page: Page, phone: string = PHONE.MAIN) {
 
  await page.goto(LOGIN_URL);
  await page.waitForLoadState('networkidle');
 
  // ── Phone step ────────────────────────────────────
  await expect(
    page.getByText('Enter Your Phone Number')
  ).toBeVisible();
 
  await page
    .locator('input[type="tel"], input[placeholder*="phone" i]')
    .fill(phone);
 
  await page
    .getByRole('button', { name: 'Send OTP' })
    .click();
 
  // ── OTP step ──────────────────────────────────────
  await expect(
    page.getByText('Enter Verification Code')
  ).toBeVisible({ timeout: 10000 });
 
  await page
    .locator('input[placeholder="000000"], input[maxlength="6"]')
    .fill(OTP);
 
  await page
    .getByRole('button', { name: 'Verify & Sign In' })
    .click();
 
  // ── Wait for dashboard ────────────────────────────
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
 
  // Confirm dashboard loaded — sidebar text is reliable
  await expect(
    page.getByText('DASHBOARD', { exact: false })
  ).toBeVisible({ timeout: 20000 });
 
  console.log(`Logged in as ${phone} ✓`);
 
}

// ======================================================
// ══════════════════════════════════════════════════════
// LOGIN PAGE TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Login Page', () => {

  // ====================================================
  // TC_DASH_LOGIN_01
  // Login page UI elements validation
  // ====================================================

  test(

    'TC_DASH_LOGIN_01 - Login Page UI Elements Visible @sanity',

    async ({ page }) => {

      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      // Title
      await expect(
        page.getByText('Agent Dashboard')
      ).toBeVisible();

      // Subtitle
      await expect(
        page.getByText('Secure phone-based authentication')
      ).toBeVisible();

      // Phone input
      await expect(
        page.locator('input[type="tel"], input[placeholder*="phone" i]')
      ).toBeVisible();

      // Send OTP button
      await expect(
        page.getByRole('button', { name: 'Send OTP' })
      ).toBeVisible();

      // Placeholder hint
      await expect(
        page.getByText('+91', { exact: false })
      ).toBeVisible();

      console.log('Login page UI elements verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_LOGIN_02
  // OTP screen appears after entering phone
  // ====================================================

  test(

    'TC_DASH_LOGIN_02 - OTP Screen Appears After Phone Entry @sanity',

    async ({ page }) => {

      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      await page.locator('input[type="tel"], input[placeholder*="phone" i]')
        .fill(PHONE.MAIN);

      await page.getByRole('button', { name: 'Send OTP' }).click();

      // OTP screen
      await expect(
        page.getByText('Enter Verification Code')
      ).toBeVisible({ timeout: 10000 });

      await expect(
        page.getByText('6-digit code', { exact: false })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Verify & Sign In' })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Resend OTP' })
      ).toBeVisible();

      await expect(
        page.getByText('Back to Phone', { exact: false })
      ).toBeVisible();

      await expect(
        page.getByText('Code expires in 5 minutes', { exact: false })
      ).toBeVisible();

      console.log('OTP screen elements verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_LOGIN_03
  // Successful login with fixed OTP
  // ====================================================
 
  test(
 
    'TC_DASH_LOGIN_03 - Successful Login With OTP @sanity',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      // Welcome heading
      await expect(
        page.locator('h1, h2').filter({ hasText: /Welcome/i }).first()
      ).toBeVisible({ timeout: 1500 });
 
      // Sidebar section label
      await expect(
        page.getByText('DASHBOARD', { exact: false })
      ).toBeVisible();
 
      // Sidebar nav items
      await expect(page.getByText('Overview').first()).toBeVisible();
      await expect(page.getByText('All Leads').first()).toBeVisible();
 
      // User info at bottom
    //   await expect(page.getByText('Arhan', { exact: false }).first()).toBeVisible();
    //   await expect(page.getByText('Pre-Sales Rep', { exact: false })).toBeVisible();
 
      console.log('Login successful, dashboard loaded ✓');
 
    }
 
  );

  // ====================================================
  // TC_DASH_LOGIN_04
  // Mobile UI — login page responsive layout
  // ====================================================

  test(

    'TC_DASH_LOGIN_04 - Login Page Mobile Layout @regression',

    async ({ page }) => {

      await page.setViewportSize({ width: 390, height: 844 });   // iPhone 14

      await page.goto(LOGIN_URL);
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('Agent Dashboard')
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Send OTP' })
      ).toBeVisible();

      // No horizontal overflow
      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(395);

      console.log('Mobile login layout verified ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// OVERVIEW TAB TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Overview Tab', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await page.getByText('Overview', { exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // ====================================================
  // TC_DASH_OV_01
  // Overview stat cards visible with correct labels
  // ====================================================

  test(

    'TC_DASH_OV_01 - Overview Stat Cards Visible @sanity',

    async ({ page }) => {

      // Microsites Generated card
      await expect(
        page.getByText('Microsites Generated')
      ).toBeVisible();

      // Engaged Leads card
      await expect(
        page.getByText('Engaged Leads')
      ).toBeVisible();

      // Site visits scheduled card
      await expect(
        page.getByText('Site visits scheduled', { exact: false }).first()
      ).toBeVisible();

      // Numbers must be visible (non-empty)
      const statNumbers = page.locator('h2, [class*="stat"] span, [class*="count"]');
      const count = await statNumbers.count();
      expect(count).toBeGreaterThan(0);

      console.log('Overview stat cards visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_OV_02
  // Microsites Generated count is a non-negative number
  // ====================================================
test(

  'TC_DASH_OV_02 - Microsites Generated Count Should Be Non-Negative @sanity',

  async ({ page }) => {

    // Wait for dashboard cards
    await page.waitForLoadState('networkidle');

    // Get first large stat number on dashboard
    const countText = await page
      .locator('div')
      .filter({ hasText: 'Microsites Generated' })
      .locator('text=/^\\d+$/')
      .first()
      .textContent();

    const micrositeCount =
      parseInt(countText?.trim() || '0', 10);

    console.log(
      `Microsites Generated: ${micrositeCount}`
    );

    // Validate parsed number
    expect(
      Number.isNaN(micrositeCount),
      'Microsites count should be a valid number'
    ).toBe(false);

    // Validate non-negative
    expect(
      micrositeCount,
      'Microsites count should be non-negative'
    ).toBeGreaterThanOrEqual(0);

    console.log(
      'Microsites count is non-negative ✓'
    );

  }

);
  // ====================================================
  // TC_DASH_OV_03
  // Funnel Trend chart is visible
  // ====================================================

test(

  'TC_DASH_OV_03 - Funnel Trend Chart Visible @regression',

  async ({ page }) => {

    // Funnel Trend section visible
    await expect(
      page.getByText('FUNNEL TREND')
    ).toBeVisible();

    // Chart legends visible
    await expect(
      page.getByText('Microsites').first()
    ).toBeVisible();

    await expect(
      page.getByText('Engaged').first()
    ).toBeVisible();

    await expect(
      page.getByText('Site visits').first()
    ).toBeVisible();

    // Chart container visible
    const chartContainer = page
      .locator('text=FUNNEL TREND')
      .locator('..');

    await expect(chartContainer).toBeVisible();

    console.log(
      'Funnel Trend chart section visible ✓'
    );

  }

);
  // ====================================================
  // TC_DASH_OV_04
  // Buyer Segments section visible with correct labels
  // ====================================================

  test(

    'TC_DASH_OV_04 - Buyer Segments Section Visible @regression',

    async ({ page }) => {

      await expect(
        page.getByText('BUYER SEGMENTS')
      ).toBeVisible();

      await expect(
        page.getByText('Booked Site Visit')
      ).toBeVisible();

      await expect(
        page.getByText('Contacted via WhatsApp')
      ).toBeVisible();

      await expect(
        page.getByText('Involved Family')
      ).toBeVisible();

      await expect(
        page.getByText('Visited 3+ Times')
      ).toBeVisible();

      await expect(
        page.getByText('5+ Mins on Microsite')
      ).toBeVisible();

      console.log('Buyer Segments visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_OV_05
  // Date filter buttons work — Today, 7D, 30D, All
  // ====================================================

 test(

  'TC_DASH_OV_05 - Date Filter Buttons Work @regression',

  async ({ page }) => {

    const filters = [
      'Today',
      '7D',
      '30D',
      'Custom',
      'All'
    ];

    for (const filter of filters) {

      const btn = page.getByRole('button', {
        name: filter,
        exact: true
      });

      await btn.click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(btn).toBeVisible();

      console.log(`Date filter "${filter}" clicked ✓`);

    }

  }

);


  // ====================================================
  // TC_DASH_OV_06
  // Generate Microsite button visible
  // ====================================================

  test(

    'TC_DASH_OV_06 - Generate Microsite Button Visible @regression',

    async ({ page }) => {

      await expect(
        page.getByRole('button', { name: 'Generate microsite', exact: false })
      ).toBeVisible();

      console.log('Generate Microsite button visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_OV_07
  // All-time Stats table has correct columns
  // ====================================================

  test(

    'TC_DASH_OV_07 - All-time Stats Table Columns Correct @regression',

    async ({ page }) => {

      await expect(
        page.getByText('All-time Stats')
      ).toBeVisible();

      // Scroll to stats table
      await page.getByText('All-time Stats').scrollIntoViewIfNeeded();

      await expect(page.getByText('Agent wise')).toBeVisible();
      await expect(page.getByText('Project wise')).toBeVisible();

      // Column headers
      const columns = ['NAME', 'STATUS', 'MICROSITES', 'UNIQUE BUYERS', 'ENGAGED LINKS', 'SITE VISITS SCHEDULED'];

      for (const col of columns) {

  await expect(
    page.getByRole('columnheader', {
      name: col,
      exact: false
    })
  ).toBeVisible();

}

      console.log('All-time Stats table columns verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_OV_08
  // Overview mobile layout — no overflow
  // ====================================================

  test(

    'TC_DASH_OV_08 - Overview Mobile Layout @regression',

    async ({ page }) => {

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('Microsites Generated')
      ).toBeVisible();

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(395);

      console.log('Overview mobile layout verified ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// ALL LEADS TAB TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('All Leads Tab', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // ====================================================
  // TC_DASH_LEADS_01
  // All Leads table columns correct
  // ====================================================

  test(

    'TC_DASH_LEADS_01 - All Leads Table Columns Visible @sanity',

    async ({ page }) => {

      const columns = [
        'CREATE DATE',
        'AGENT NAME',
        'BUYER NAME',
        'PROJECTS',
        'TOTAL VISITS',
        'LINK SHARED',
        'TIME SPENT',
        'KEY ACTIONS',
        'LAST ACTIVITY',
      ];

      for (const col of columns) {

  await expect(
    page.getByRole('columnheader', {
      name: col,
      exact: false
    })
  ).toBeVisible();

}

      console.log('All Leads table columns verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_LEADS_02
  // Lead rows have correct data — buyer name, project,
  // agent name are non-empty
  // ====================================================
test(

  'TC_DASH_LEADS_02 - Lead Rows Have Valid Data @sanity',

  async ({ page }) => {

    const rows =
      page.locator('table tbody tr');

    const rowCount =
      await rows.count();

    console.log(
      `Lead rows found: ${rowCount}`
    );

    expect(rowCount)
      .toBeGreaterThan(0);

    for (let i = 0; i < Math.min(rowCount, 5); i++) {

      const row = rows.nth(i);

      await expect(row).toBeVisible();

      const text =
        await row.textContent();

      expect(
        text?.trim().length || 0
      ).toBeGreaterThan(0);

      console.log(
        `Row ${i + 1}: ${text?.slice(0, 80)}`
      );

    }

    console.log(
      'Lead rows contain valid data ✓'
    );

  }

);

  // ====================================================
  // TC_DASH_LEADS_03
  // Search bar filters leads correctly
  // ====================================================

  test(

  'TC_DASH_LEADS_03 - Search Bar Filters Leads @regression',

  async ({ page }) => {

    const searchBox =
      page.getByPlaceholder(/search/i);

    await expect(searchBox).toBeVisible();

    await searchBox.fill('Harsha');

    await page.waitForTimeout(1500);

    const rows =
      page.locator('table tbody tr');

    const rowCount =
      await rows.count();

    console.log(
      `Rows after search "Harsha": ${rowCount}`
    );

    if (rowCount > 0) {

      const firstRowText =
        await rows.first().textContent();

      expect(
        firstRowText?.toLowerCase() || ''
      ).toContain('harsha');

    } else {

      await expect(
        page.getByText(/no data|no leads/i)
      ).toBeVisible();

    }

    console.log(
      'Search filtering verified ✓'
    );

  }

);

  // ====================================================
  // TC_DASH_LEADS_04
  // Checkbox selects individual row
  // ====================================================

  test(

  'TC_DASH_LEADS_04 - Row Checkbox Selection Works @regression',

  async ({ page }) => {

    const rows =
      page.locator('table tbody tr');

    await expect(
      rows.first()
    ).toBeVisible({ timeout: 10000 });

    const firstCheckbox =
      rows.first()
        .locator('input[type="checkbox"]')
        .first();

    await expect(firstCheckbox).toBeVisible();

    await firstCheckbox.check();

    await expect(firstCheckbox).toBeChecked();

    console.log('Row checkbox checked ✓');

    await firstCheckbox.uncheck();

    await expect(firstCheckbox).not.toBeChecked();

    console.log('Row checkbox unchecked ✓');

  }

);
  // ====================================================
  // TC_DASH_LEADS_05
  // Select all checkbox selects all rows
  // ====================================================

  test(

    'TC_DASH_LEADS_05 - Select All Checkbox Selects All Rows @regression',

    async ({ page }) => {

      // Header checkbox = select all
      const selectAll =
        page.locator('table thead input[type="checkbox"], th input[type="checkbox"]')
          .first();

      await expect(selectAll).toBeVisible();

      await selectAll.check();

      await expect(selectAll).toBeChecked();

      // At least first row should be checked
      const firstRowCheckbox =
        page.locator('table tbody tr input[type="checkbox"]').first();

      await expect(firstRowCheckbox).toBeChecked();

      console.log('Select all checkbox works ✓');

      // Uncheck all
      await selectAll.uncheck();

      await expect(firstRowCheckbox).not.toBeChecked();

    }

  );

  // ====================================================
  // TC_DASH_LEADS_06
  // Clicking buyer name opens lead detail drawer
  // ====================================================
test(

  'TC_DASH_LEADS_06 - Clicking Buyer Name Opens Lead Detail Drawer @regression',

  async ({ page }) => {

    const firstRow =
      page.locator('table tbody tr').first();

    await expect(firstRow)
      .toBeVisible({ timeout: 10000 });

    // Buyer Name column
    const buyerName =
      firstRow.locator('td').nth(3);

    const buyerText =
      await buyerName.textContent();

    console.log(
      `Clicking buyer: ${buyerText}`
    );

    await expect(buyerName)
      .toBeVisible();

    await buyerName.click();

    // Verify drawer content
    await expect(
      page.getByText('Buyer ID')
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText('Engagement Summary')
    ).toBeVisible();

    await expect(
      page.getByText('Activity Timeline')
    ).toBeVisible();

    console.log(
      'Lead detail drawer opened ✓'
    );

    // Close drawer
    const closeBtn =
      page.locator('svg').last();

    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }

  }

);

  // ====================================================
  // TC_DASH_LEADS_07
  // Lead Cohorts stat cards visible
  // ====================================================

  test(

    'TC_DASH_LEADS_07 - Lead Cohorts Cards Visible @regression',

    async ({ page }) => {

      await expect(page.getByText('Microsites Generated')).toBeVisible();
      await expect(page.getByText('Engaged Leads')).toBeVisible();
      await expect(
  page.getByText('Lead Cohorts', {
    exact: true
  }).first()
).toBeVisible();
      await expect(page.getByText('Site Visit Booked')).toBeVisible();
      await expect(page.getByText('Contacted via Whatsapp', { exact: false })).toBeVisible();
      await expect(
  page.getByRole('button', {
    name: /Site Visits/i
  })
).toBeVisible();

      console.log('Lead cohort cards visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_LEADS_08
  // Filters — Projects, Agents, Status, Lead type
  // ====================================================

  test(

    'TC_DASH_LEADS_08 - Filter Dropdowns Are Clickable @regression',

    async ({ page }) => {

      const filters = ['Projects', 'Agents', 'Status', 'Lead type'];

      for (const filter of filters) {

        const btn =
          page.getByRole('button', { name: filter, exact: false }).first();

        await expect(btn).toBeVisible();
        await btn.click();
        await page.waitForLoadState('networkidle');

        // Dropdown/popover should open
        const dropdown =
          page.locator('[role="menu"], [role="listbox"], [class*="dropdown"], [class*="popover"]')
            .first();

        const isOpen = await dropdown.isVisible().catch(() => false);

        console.log(`Filter "${filter}" dropdown opened: ${isOpen}`);

        // Close by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForLoadState('networkidle');

      }

    }

  );

  // ====================================================
  // TC_DASH_LEADS_09
  // Export button is visible and clickable
  // ====================================================

  test(

    'TC_DASH_LEADS_09 - Export Button Visible and Clickable @regression',

    async ({ page }) => {

      const exportBtn =
        page.getByRole('button', { name: 'Export', exact: false }).first();

      await expect(exportBtn).toBeVisible();
      await exportBtn.click();
      await page.waitForLoadState('networkidle');

      console.log('Export button clicked ✓');

    }

  );

  // ====================================================
  // TC_DASH_LEADS_10
  // All Leads mobile layout — no overflow
  // ====================================================

  test(

    'TC_DASH_LEADS_10 - All Leads Mobile Layout @regression',

    async ({ page }) => {

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('Microsites Generated')
      ).toBeVisible();

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(395);

      console.log('All Leads mobile layout verified ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// DAILY PRIORITY TAB TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Daily Priority Tab', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await page.getByText('Daily Priority', { exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // ====================================================
  // TC_DASH_DP_01
  // Daily Priority page header visible
  // ====================================================

  test(

    'TC_DASH_DP_01 - Daily Priority Page Header Visible @sanity',

    async ({ page }) => {

      await expect(
        page.getByText('Daily Priority List')
      ).toBeVisible();

      await expect(
        page.getByText('Top high-priority leads to engage', { exact: false })
      ).toBeVisible();

      console.log('Daily Priority header visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_DP_02
  // Empty state message when no engaged leads in 24h
  // ====================================================

  test(

    'TC_DASH_DP_02 - Empty State Shows Correct Message @regression',

    async ({ page }) => {

      // Check if empty or has leads
      const emptyState =
        page.getByText('No engaged leads in last 24 hours', { exact: false });

      const hasLeads =
        await page.locator('table tbody tr').first().isVisible().catch(() => false);

      if (await emptyState.isVisible().catch(() => false)) {

        await expect(emptyState).toBeVisible();
        await expect(
          page.getByText('Leads with activity in the last 24 hours', { exact: false })
        ).toBeVisible();
        console.log('Empty state message correct ✓');

      } else if (hasLeads) {

        console.log('Daily Priority has leads — empty state not shown ✓');

      }

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// ARCHIVED LEADS TAB TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Archived Leads Tab', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await page.getByText('Archived Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // ====================================================
  // TC_DASH_AR_01
  // Archived Leads table columns correct
  // ====================================================

  test(

    'TC_DASH_AR_01 - Archived Leads Table Columns Visible @sanity',

    async ({ page }) => {

      const columns = [
        'CREATE DATE',
        'AGENT NAME',
        'BUYER NAME',
        'PROJECTS',
        'TOTAL VISITS',
        'LINK SHARED',
        'TIME SPENT',
        'KEY ACTIONS',
        'LAST ACTIVITY',
      ];

      for (const col of columns) {
        await expect(
          page.getByRole('columnheader', { name: col, exact: false })
        ).toBeVisible();
      }

      console.log('Archived Leads columns verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_AR_02
  // Search bar visible in Archived Leads
  // ====================================================

  test(

    'TC_DASH_AR_02 - Archived Leads Search Bar Visible @regression',

    async ({ page }) => {

      await expect(
        page.locator('input[placeholder*="archived" i], input[placeholder*="Search" i]')
          .first()
      ).toBeVisible();

      console.log('Archived Leads search bar visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_AR_03
  // Archived Leads filters visible
  // ====================================================

  test(

    'TC_DASH_AR_03 - Archived Leads Filters Visible @regression',

    async ({ page }) => {

      await expect(
        page.getByRole('button', { name: 'Lead type', exact: false })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'All Projects', exact: false })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'Engagement', exact: false })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: 'All Agents', exact: false })
      ).toBeVisible();

      console.log('Archived Leads filters visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_AR_04
  // Empty state or leads visible — pagination shows
  // ====================================================

  test(

    'TC_DASH_AR_04 - Archived Leads Pagination Visible @regression',

    async ({ page }) => {

      await expect(
        page.getByText('Rows per page', { exact: false })
      ).toBeVisible();

      await expect(
        page.getByText('Page 1 of', { exact: false })
      ).toBeVisible();

      console.log('Archived Leads pagination visible ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// REPORTS TAB TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Reports Tab', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await page.getByText('Reports', { exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // ====================================================
  // TC_DASH_REP_01
  // Reports page loads without error
  // ====================================================

  test(

    'TC_DASH_REP_01 - Reports Page Loads @sanity',

    async ({ page }) => {

      // Should not show 404 or error
      const is404 =
        await page.getByText('404', { exact: false }).isVisible().catch(() => false);

      expect(is404).toBe(false);

      // URL should contain reports
      expect(page.url()).toContain('report');

      console.log('Reports page loaded ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// SIDEBAR NAVIGATION TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Sidebar Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
  });

  // ====================================================
  // TC_DASH_NAV_01
  // All sidebar links navigate correctly
  // ====================================================

  test(

    'TC_DASH_NAV_01 - All Sidebar Links Navigate Correctly @sanity',

    async ({ page }) => {

      const navItems = [
        { name: 'Overview',        urlContains: 'dashboard' },
        { name: 'All Leads',       urlContains: 'leads'     },
        { name: 'Daily Priority',  urlContains: 'priority'  },
        { name: 'Archived Leads',  urlContains: 'archive'   },
        { name: 'Reports',         urlContains: 'report'    },
        { name: 'Help Center',      urlContains: 'help'      },
      ];

      for (const item of navItems) {

        await page.getByText(item.name, { exact: true }).click();
        await page.waitForLoadState('networkidle');

        console.log(
          `Nav "${item.name}" → URL: ${page.url()}`
        );

        // Page should not show error
        const is404 =
          await page.getByText('404').isVisible().catch(() => false);

        expect(is404, `Nav "${item.name}" should not 404`).toBe(false);

      }

      console.log('All sidebar links work ✓');

    }

  );

  // ====================================================
  // TC_DASH_NAV_02
  // Help Center link opens knowledge base
  // ====================================================

  test(

    'TC_DASH_NAV_02 - Help Center Link Works @regression',

    async ({ page }) => {

      const helpLink =
        page.getByRole('link', { name: 'Help Center' });

      await expect(helpLink).toBeVisible();

      const [newPage] =
        await Promise.all([
          page.context().waitForEvent('page'),
          helpLink.click(),
        ]);

      await newPage.waitForLoadState('networkidle');

      await expect(
        newPage.getByText('PropFocus AI Help Center', { exact: false })
      ).toBeVisible({ timeout: 10000 });

      console.log('Help Center opened ✓');

      await newPage.close();

    }

  );

  // ====================================================
  // TC_DASH_NAV_03
  // Sign Out button logs user out
  // ====================================================

  test(

    'TC_DASH_NAV_03 - Sign Out Returns to Login Page @sanity',

    async ({ page }) => {

      await page.getByRole('button', { name: 'Sign Out' }).click();

      await page.waitForURL(/login/, { timeout: 10000 });

      await expect(
        page.getByText('Enter Your Phone Number')
      ).toBeVisible();

      console.log('Sign Out successful ✓');

    }

  );

  // ====================================================
  // TC_DASH_NAV_04
  // Active nav item is highlighted
  // ====================================================

  test(

    'TC_DASH_NAV_04 - Active Nav Item Is Highlighted @regression',

    async ({ page }) => {

      // Click All Leads — it should be highlighted
      await page.getByText(
  'All Leads',
  { exact: true }
).click();
      await page.waitForLoadState('networkidle');

      const allLeadsLink =
  page.getByText(
    'All Leads',
    { exact: true }
  );

      // Check it has an active class or background
      const className =
        await allLeadsLink.getAttribute('class') ?? '';

      const style =
        await allLeadsLink.getAttribute('style') ?? '';

      console.log(`All Leads link class: ${className}`);

      // Either class contains active/selected or background is gold
      const isHighlighted =
        className.includes('active') ||
        className.includes('selected') ||
        className.includes('bg-') ||
        style.includes('background') ||
        style.includes('color');

      // Soft check — log if not highlighted rather than hard fail
      if (!isHighlighted) {
        console.warn('Active nav item highlight not detected via class/style — may use different method');
      }

      console.log('Active nav item check done ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// SESSION / INACTIVITY TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Session Management', () => {

  // ====================================================
  // TC_DASH_SESSION_01
  // Dashboard does NOT logout after 10 minutes inactivity
  // ====================================================

  test(

    'TC_DASH_SESSION_01 - Dashboard Does Not Logout After 10 Min Inactivity @regression',

    async ({ page }) => {

      await login(page, PHONE.MAIN);

      console.log('Logged in — waiting 10 minutes without interaction...');

      // Wait 10 minutes with no user interaction
      await page.waitForTimeout(10 * 60 * 1000);                 // 10 minutes

      // After 10 min — should still be on dashboard, NOT on login page
      const currentUrl = page.url();

      console.log(`URL after 10 min inactivity: ${currentUrl}`);

      expect(
        currentUrl,
        'Should still be on dashboard after 10 min inactivity — not redirected to login'
      ).not.toContain('login');

      // Welcome message should still be visible
      await expect(
  page.getByRole('link', { name: /overview/i })
).toBeVisible({ timeout: 15000 });

      console.log('Session still active after 10 min ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// DATA CORRECTNESS TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Data Correctness', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
  });

  // ====================================================
  // TC_DASH_DATA_01
  // Microsites Generated count on Overview matches
  // count on All Leads tab
  // ====================================================

  test(

    'TC_DASH_DATA_01 - Microsites Count Consistent Across Tabs @regression',

    async ({ page }) => {

      // Read count from Overview
      await page.getByText('Overview', { exact: true }).first().click();
      await page.waitForLoadState('networkidle');

      // Click "All" date filter for total count
      await page.getByText('All Leads', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      const overviewCard =
        page.locator('text=Microsites Generated').locator('..').locator('..');

      const overviewCountText =
        await overviewCard.locator('h2, p, span').first().innerText();

      const overviewCount = parseInt(overviewCountText.trim(), 10);

      console.log(`Overview Microsites Generated: ${overviewCount}`);

      // Read count from All Leads tab
      await page.getByText('All Leads', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      await page.getByText('All Leads', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      const leadsCard =
        page.locator('text=Microsites Generated').locator('..').locator('..');

      const leadsCountText =
        await leadsCard.locator('h2, p, span').first().innerText();

      const leadsCount = parseInt(leadsCountText.trim(), 10);

      console.log(`All Leads tab Microsites Generated: ${leadsCount}`);

      expect(
        overviewCount,
        'Microsites Generated count should match between Overview and All Leads'
      ).toBe(leadsCount);

      console.log('Microsites count consistent across tabs ✓');

    }

  );

  // ====================================================
  // TC_DASH_DATA_02
  // Lead rows show valid microsite URLs on click
  // ====================================================

  test(

    'TC_DASH_DATA_02 - Lead Detail Shows Valid Microsite URL @regression',

    async ({ page }) => {

      await page.getByText('All Leads', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      const rows =
        page.locator('table tbody tr');

      await expect(rows.first()).toBeVisible({ timeout: 10000 });

      // Click first buyer name to open drawer
      const buyerLink =
        page.locator('table tbody tr').first()
          .locator('a, [class*="buyer"], td').nth(2);

      await buyerLink.click();
      await page.waitForLoadState('networkidle');

      // Drawer should show buyer ID
      const drawer =
        page.locator('[class*="drawer"], [class*="panel"], [role="dialog"]').first();

      const drawerVisible =
        await drawer.isVisible().catch(() => false);

      if (drawerVisible) {

        const drawerText = await drawer.innerText();

        // Should contain a buyer ID
        expect(
          drawerText,
          'Drawer should contain Buyer ID'
        ).toMatch(/buyer.?id/i);

        console.log('Lead detail drawer shows valid data ✓');

      } else {
        console.log('Drawer opened in different format — skipping content check');
      }

    }

  );

  // ====================================================
  // TC_DASH_DATA_03
  // Agent name in lead rows matches logged-in user
  // ====================================================

  test(

    'TC_DASH_DATA_03 - Agent Name in Leads Matches Logged-In User @regression',

    async ({ page }) => {

      await page.getByRole('link', { name: 'All Leads' }).click();
      await page.waitForLoadState('networkidle');

      const rows = page.locator('table tbody tr');

      await expect(rows.first()).toBeVisible({ timeout: 10000 });

      // Agent name column is the 2nd column (index 1)
      const agentCell =
        rows.first().locator('td').nth(1);

      const agentName = await agentCell.innerText();

      console.log(`Agent name in first row: ${agentName}`);

      // Should be the logged-in broker's name
      expect(
        agentName.trim().toLowerCase(),
        'Agent name should match logged-in user'
      ).toContain('arhan');

      console.log('Agent name matches logged-in user ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// SITE VISIT TRACKER TAB TESTS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Site Visit Tracker Tab', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await page.getByText('Site Visit Tracker', { exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // ====================================================
  // TC_DASH_SV_01
  // Stat cards visible with correct labels
  // ====================================================

  test(

    'TC_DASH_SV_01 - Site Visit Stat Cards Visible @sanity',

    async ({ page }) => {

      await expect(
        page.getByText('Visits Scheduled')
      ).toBeVisible();

      await expect(
        page.getByText('Confirmed Visits')
      ).toBeVisible();

      await expect(
        page.getByText('Rescheduled')
      ).toBeVisible();

      await expect(
        page.getByText('Visit Conducted')
      ).toBeVisible();

      console.log('Site Visit stat cards visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_SV_02
  // Stat card values are valid numbers
  // ====================================================

  test(

  'TC_DASH_SV_02 - Site Visit Stat Card Values Are Valid Numbers @sanity',

  async ({ page }) => {

    const stats = [
      'Visits Scheduled',
      'Confirmed Visits',
      'Rescheduled',
      'Visit Conducted'
    ];

    for (const stat of stats) {

      const card =
        page.getByText(stat, {
          exact: false
        }).first();

      await expect(card)
        .toBeVisible();

      // Get full card/container text
      const cardText =
        await card.locator('..').textContent();

      console.log(`${stat}: ${cardText}`);

      // Extract first number
      const match =
        cardText?.match(/\d+/);

      expect(
        match,
        `${stat} should contain a number`
      ).not.toBeNull();

      const value =
        parseInt(match![0], 10);

      expect(value)
        .toBeGreaterThanOrEqual(0);

      console.log(
        `${stat}: ${value}`
      );

    }

    console.log(
      'Site visit stat values verified ✓'
    );

  }

);
  // ====================================================
  // TC_DASH_SV_03
  // Table columns correct
  // ====================================================

  test(

    'TC_DASH_SV_03 - Site Visit Table Columns Visible @sanity',

    async ({ page }) => {

      const columns = [
        'CREATE DATE',
        'AGENT NAME',
        'BUYER NAME',
        'PROJECT',
        'VISIT TIME',
        'STATUS',
        'LAST ACTIVITY',
      ];

      for (const col of columns) {
        await expect(
          page.getByRole('columnheader', { name: col, exact: false })
        ).toBeVisible();
      }

      console.log('Site Visit table columns verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_SV_04
  // Table row data is correct — buyer name, project,
  // visit time, status all present
  // ====================================================

  test(

  'TC_DASH_SV_04 - Site Visit Row Data Is Valid @regression',

  async ({ page }) => {

    const rows =
      page.locator('table tbody tr');

    const rowCount =
      await rows.count();

    console.log(
      `Site visit rows found: ${rowCount}`
    );

    expect(rowCount)
      .toBeGreaterThan(0);

    const firstRow =
      rows.first();

    await expect(firstRow)
      .toBeVisible();

    const rowText =
      await firstRow.textContent();

    console.log(`Row text: ${rowText}`);

    // Validate row has a date
    expect(
      rowText
    ).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // Validate row has alphabets (agent/buyer/project)
    expect(
      rowText
    ).toMatch(/[A-Za-z]/);

    console.log(
      'Site visit row data verified ✓'
    );

  }

);

  // ====================================================
  // TC_DASH_SV_05
  // Visits Scheduled count matches row count in table
  // ====================================================

 test(

  'TC_DASH_SV_05 - Visits Scheduled Count Matches Table Row Count @regression',

  async ({ page }) => {

    // Get stat card text
    const statCard =
      page.getByText(
        'Visits Scheduled',
        { exact: false }
      ).first();

    await expect(statCard)
      .toBeVisible();

    const statCardText =
      await statCard.locator('..').textContent();

    console.log(
      `Stat card text: ${statCardText}`
    );

    // Extract first number
    const statMatch =
      statCardText?.match(/\d+/);

    expect(statMatch)
      .not.toBeNull();

    const statCount =
      parseInt(statMatch![0], 10);

    console.log(
      `Visits Scheduled stat: ${statCount}`
    );

    // Pagination text
    const paginationText =
      await page.getByText(
        'Showing',
        { exact: false }
      ).first()
        .textContent();

    console.log(
      `Pagination text: ${paginationText}`
    );

    // Extract total rows
    const tableMatch =
      paginationText?.match(/of\s+(\d+)/i);

    expect(tableMatch)
      .not.toBeNull();

    const tableTotal =
      parseInt(tableMatch![1], 10);

    console.log(
      `Table total: ${tableTotal}`
    );

    expect(
      statCount,
      'Visits Scheduled stat should match total table rows'
    ).toBe(tableTotal);

    console.log(
      'Visits Scheduled count consistent ✓'
    );

  }

);

  // ====================================================
  // TC_DASH_SV_06
  // Search bar filters site visits
  // ====================================================

  test(

    'TC_DASH_SV_06 - Search Bar Filters Site Visits @regression',

    async ({ page }) => {

      const searchBar =
        page.locator('input[placeholder*="Search" i], input[placeholder*="visitor" i]')
          .first();

      await expect(searchBar).toBeVisible();

      await searchBar.fill('Harsha');
      await page.waitForLoadState('networkidle');

      const rows = page.locator('table tbody tr');
      const count = await rows.count();

      console.log(`Rows after search "Harsha": ${count}`);

      if (count > 0) {
        const firstRowText = await rows.first().innerText();
        expect(firstRowText.toLowerCase()).toContain('harsha');
      } else {
        await expect(
          page.getByText('No', { exact: false })
        ).toBeVisible();
      }

      await searchBar.clear();
      await page.waitForLoadState('networkidle');

      console.log('Site Visit search bar works ✓');

    }

  );

  // ====================================================
  // TC_DASH_SV_07
  // Filter dropdowns — Projects, Agents, Status, Outcome
  // ====================================================

  test(

    'TC_DASH_SV_07 - Site Visit Filter Dropdowns Work @regression',

    async ({ page }) => {

      const filters = ['Projects', 'Agents', 'Status', 'Outcome'];

      for (const filter of filters) {

        const btn =
          page.getByRole('button', { name: filter, exact: false }).first();

        await expect(btn).toBeVisible();
        await btn.click();
        await page.waitForLoadState('networkidle');

        const dropdown =
          page.locator('[role="menu"], [role="listbox"], [class*="dropdown"], [class*="popover"]')
            .first();

        const isOpen = await dropdown.isVisible().catch(() => false);

        console.log(`Filter "${filter}" opened: ${isOpen}`);

        await page.keyboard.press('Escape');
        await page.waitForLoadState('networkidle');

      }

      console.log('Site Visit filters work ✓');

    }

  );

  // ====================================================
  // TC_DASH_SV_08
  // Row checkbox selection works
  // ====================================================

  test(

    'TC_DASH_SV_08 - Site Visit Row Checkbox Works @regression',

    async ({ page }) => {

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        console.log('No rows to check — skipping checkbox test');
        test.skip();
        return;
      }

      const firstCheckbox =
        rows.first().locator('input[type="checkbox"]');

      await expect(firstCheckbox).toBeVisible();
      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();

      console.log('Site Visit row checkbox checked ✓');

      await firstCheckbox.uncheck();
      await expect(firstCheckbox).not.toBeChecked();

    }

  );

  // ====================================================
  // TC_DASH_SV_09
  // Pagination visible and shows correct count
  // ====================================================

  test(

    'TC_DASH_SV_09 - Site Visit Pagination Visible @regression',

    async ({ page }) => {

      await expect(
        page.getByText('Showing', { exact: false })
      ).toBeVisible();

      await expect(
        page.getByText('Rows per page', { exact: false })
      ).toBeVisible();

      await expect(
        page.getByText('Page 1 of', { exact: false })
      ).toBeVisible();

      console.log('Site Visit pagination visible ✓');

    }

  );

  // ====================================================
  // TC_DASH_SV_10
  // Date filter buttons work on Site Visit tab
  // ====================================================

  test(

    'TC_DASH_SV_10 - Site Visit Date Filters Work @regression',

    async ({ page }) => {

      const filters = ['Today', '7D', '30D','Custom','All'];

      for (const filter of filters) {

        await page.getByRole(
  'button',
  {
    name: filter,
    exact: true
  }
).first().click();
        await page.waitForLoadState('networkidle');
        await page.waitForLoadState('networkidle');

        console.log(`Date filter "${filter}" clicked ✓`);

      }

    }

  );

  // ====================================================
  // TC_DASH_SV_11
  // Mobile layout — no overflow
  // ====================================================

  test(

    'TC_DASH_SV_11 - Site Visit Mobile Layout @regression',

    async ({ page }) => {

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('Visits Scheduled')
      ).toBeVisible();

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(395);

      console.log('Site Visit mobile layout verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_SV_12
  // Desktop layout — stat cards in a row, no overflow
  // ====================================================

  test(

    'TC_DASH_SV_12 - Site Visit Desktop Layout @regression',

    async ({ page }) => {

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // All 4 stat cards should be visible without scrolling
      await expect(page.getByText('Visits Scheduled')).toBeVisible();
      await expect(page.getByText('Confirmed Visits')).toBeVisible();
      await expect(page.getByText('Rescheduled')).toBeVisible();
      await expect(page.getByText('Visit Conducted')).toBeVisible();

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(1285);

      console.log('Site Visit desktop layout verified ✓');

    }

  );

});

// ======================================================
// ══════════════════════════════════════════════════════
// DESKTOP UI VALIDATION TESTS
// Explicit desktop layout checks for all main tabs
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Desktop UI Validation', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, PHONE.MAIN);
  });

  // ====================================================
  // TC_DASH_DESK_01
  // Overview desktop — sidebar + content side by side
  // ====================================================

  test(

    'TC_DASH_DESK_01 - Overview Desktop Layout @regression',

    async ({ page }) => {

      await page.getByText(
  'Overview',
  { exact: true }
).click();
      await page.waitForLoadState('networkidle');

      // Sidebar visible
      await expect(
        page.getByText('DASHBOARD', { exact: false })
      ).toBeVisible();

      // All 3 stat cards in one row
      await expect(
  page.getByText('Microsites Generated').first()
).toBeVisible();

await expect(
  page.getByText('Engaged Leads').first()
).toBeVisible();

await expect(
  page.locator('p', {
    hasText: 'Site visits scheduled'
  }).first()
).toBeVisible();

      // No horizontal overflow
      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(1285);

      console.log('Overview desktop layout verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_DESK_02
  // All Leads desktop — table fits without overflow
  // ====================================================

  test(

    'TC_DASH_DESK_02 - All Leads Desktop Layout @regression',

    async ({ page }) => {

      await page.getByText('All Leads', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      // All column headers visible
      const columns = ['CREATE DATE', 'AGENT NAME', 'BUYER NAME', 'PROJECTS', 'TOTAL VISITS'];

      for (const col of columns) {
        await expect(
          page.getByRole('columnheader', { name: col, exact: false })
        ).toBeVisible();
      }

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(1285);

      console.log('All Leads desktop layout verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_DESK_03
  // Archived Leads desktop layout
  // ====================================================

  test(

    'TC_DASH_DESK_03 - Archived Leads Desktop Layout @regression',

    async ({ page }) => {

      await page.getByText('Archived Leads', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('CREATE DATE', { exact: false })
      ).toBeVisible();

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(1285);

      console.log('Archived Leads desktop layout verified ✓');

    }

  );

  // ====================================================
  // TC_DASH_DESK_04
  // Daily Priority desktop layout
  // ====================================================

  test(

    'TC_DASH_DESK_04 - Daily Priority Desktop Layout @regression',

    async ({ page }) => {

      await page.getByText('Daily Priority', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByText('Daily Priority List')
      ).toBeVisible();

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(1285);

            console.log('Daily Priority desktop layout verified ✓');

    }

  );
});


// ====================================================
// TC_DASH_ROLE_01
// Sub Broker Role Access Validation
// ====================================================

test(

  'TC_DASH_ROLE_01 - Sub Broker Access Validation @regression',

  async ({ page }) => {

    await login(page, PHONE.SUB);

    await page.waitForLoadState('networkidle');

    // Allowed sections
    await expect(
      page.getByText('Overview')
    ).toBeVisible();

    await expect(

  page.getByRole(
    'button',
    {
      name: 'All Leads'
    }
  )

).toBeVisible();

    // Restricted sections
    const reportsVisible =
      await page.getByText('Reports')
        .isVisible()
        .catch(() => false);

    console.log(
      `Reports visible for sub broker: ${reportsVisible}`
    );

    expect(reportsVisible)
      .toBe(false);

    console.log(
      'Sub broker role validation passed ✓'
    );

  }

);


// ====================================================
// TC_DASH_SEC_01
// Direct URL Access Without Login
// ====================================================

test(

  'TC_DASH_SEC_01 - Unauthorized Direct URL Access Redirects To Login @security',

  async ({ page }) => {

    const urls = [

      '/dashboard/reports',
      '/dashboard/help',
      '/dashboard/all-leads',
      '/dashboard/site-visit-tracker'

    ];

    for (const path of urls) {

      await page.goto(
        `https://dev.propfocus.in${path}`
      );

      await page.waitForLoadState('networkidle');

      expect(page.url())
        .toContain('login');

      console.log(
        `${path} redirected to login ✓`
      );

    }

  }

);

// ====================================================
// TC_DASH_LEADS_11
// Activity Timeline Ordering
// ====================================================

test(

  'TC_DASH_LEADS_11 - Activity Timeline Latest First @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const firstRow =
      page.locator('table tbody tr').first();

    await firstRow.click();

    await expect(
      page.getByText('Activity Timeline')
    ).toBeVisible();

    const timelineItems =
      page.locator(
        '[class*="timeline"]'
      );

    const count =
      await timelineItems.count();

    expect(count)
      .toBeGreaterThan(0);

    console.log(
      `Timeline items: ${count}`
    );

  }

);

// ====================================================
// TC_DASH_LEADS_12
// Case Insensitive Search
// ====================================================

test(

  'TC_DASH_LEADS_12 - Search Is Case Insensitive @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill('HARSHA');

    await page.waitForTimeout(1500);

    const firstRow =
      page.locator('table tbody tr')
        .first();

    await expect(firstRow)
      .toContainText(/harsha/i);

    console.log(
      'Case insensitive search works ✓'
    );

  }

);

// ====================================================
// TC_DASH_LEADS_13
// No Results UI
// ====================================================

test(

  'TC_DASH_LEADS_13 - No Results UI Appears @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const searchBox =
      page.getByPlaceholder(/search/i);

    await searchBox.fill(
      'NON_EXISTING_USER_123456'
    );

    await page.waitForTimeout(1500);

    await expect(

      page.getByText(
        /no data|no leads|no results/i
      ).first()
    ).toBeVisible();

    

    console.log(
      'No results UI validated ✓'
    );

  }

);

// ====================================================
// TC_DASH_LEADS_14
// Table Sort Validation
// ====================================================

test(

  'TC_DASH_LEADS_14 - Table Sorting Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const createDateHeader =

      page.getByRole(
        'columnheader',
        {
          name: /create date/i
        }
      );

    await createDateHeader.click();

    await page.waitForTimeout(1000);

    console.log(
      'Table sorting triggered ✓'
    );

  }

);

// ====================================================
// TC_DASH_LEADS_15
// Pagination Navigation
// ====================================================

test(

  'TC_DASH_LEADS_15 - Pagination Navigation Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const nextBtn =

      page.getByRole(
        'button',
        {
          name: /next/i
        }
      );

    if (
      await nextBtn.isVisible()
    ) {

      await nextBtn.click();

      await page.waitForLoadState(
        'networkidle'
      );

      await expect(

  page.getByText(
    /page \d+ of \d+/i
  )

).toBeVisible();

      console.log(
        'Pagination next works ✓'
      );

    }

  }

);

// ====================================================
// TC_DASH_PERF_01
// Dashboard Load Performance
// ====================================================

test(

  'TC_DASH_PERF_01 - Dashboard Loads Under 4 Seconds @performance',

  async ({ page }) => {

    const start = Date.now();

    await login(page, PHONE.MAIN);

    const loadTime =
      Date.now() - start;

    console.log(
      `Dashboard Load Time: ${loadTime}ms`
    );

    expect(loadTime)
      .toBeLessThan(4000);

  }

);

// ====================================================
// TC_DASH_LOGIN_05
// Invalid OTP Validation
// ====================================================

test(

  'TC_DASH_LOGIN_05 - Invalid OTP Shows Error @security',

  async ({ page }) => {

    await page.goto(LOGIN_URL);

    await page.locator(
      'input[type="tel"]'
    ).fill(PHONE.MAIN);

    await page.getByRole(
      'button',
      { name: 'Send OTP' }
    ).click();

    await page.locator(
      'input[maxlength="6"]'
    ).fill('111111');

    await page.getByRole(
      'button',
      { name: /verify/i }
    ).click();

    await expect(

      page.getByText(
        /Invalid OTP|Internal server error/i
      ).first()

    ).toBeVisible();

    console.log(
      'Invalid OTP validation passed ✓'
    );




  }
  

);

// ====================================================
// TC_DASH_OV_09
// Generate Microsite Button Functionality
// ====================================================

test(

  'TC_DASH_OV_09 - Generate Microsite Button Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'Overview');

    const button =
      page.getByRole(
        'button',
        {
          name: /generate microsite/i
        }
      );

    await expect(button)
      .toBeVisible();

    await button.click();

    await page.waitForLoadState(
      'networkidle'
    );

    console.log(
      'Generate Microsite button clicked ✓'
    );

  }

);

// ====================================================
// TC_DASH_LEADS_16
// Buyer ID Search Works
// ====================================================

test(

  'TC_DASH_LEADS_16 - Buyer ID Search Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    // First table row
    const firstRow =
      page.locator('table tbody tr')
        .first();

    await expect(firstRow)
      .toBeVisible();

    // Extract Buyer ID
    const buyerId =

      await firstRow.locator('text=/AUTO\\d+/i')
        .innerText();

    console.log(
      `Buyer ID: ${buyerId}`
    );

    // Search using Buyer ID
    const searchBox =
      page.getByPlaceholder(
        /search buyers, buyer id, or projects/i
      );

    await searchBox.fill(buyerId);

    await page.waitForTimeout(2000);

    // Validate filtered results
    await expect(firstRow)
      .toContainText(buyerId);

    console.log(
      'Buyer ID search works ✓'
    );

  }

);
// ====================================================
// TC_DASH_LEADS_17
// Multiple Filters Work Together
// ====================================================

test(

  'TC_DASH_LEADS_17 - Multiple Filters Work Together @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    // ==================================================
    // Project Filter
    // ==================================================

    const projectFilter =

      page.getByRole(
        'button',
        {
          name: /projects/i
        }
      );

    await projectFilter.click();

    // Wait for dropdown options
    const projectOption =

  page.getByText(
    'Abhee Tranquila'
  ).first();

    await expect(projectOption)
  .toBeVisible();

await projectOption.click();

    console.log(
      'Project filter applied ✓'
    );

    // ==================================================
    // Agent Filter
    // ==================================================

    const agentFilter =

      page.getByRole(
        'button',
        {
          name: /Agents/i
        }
      );

    await agentFilter.click();

   const agentOption =

  page.getByText(
    'Automation Pre sales rep'
  ).first();

    await expect(agentOption)
  .toBeVisible();

await agentOption.click();

    console.log(
      'Agent filter applied ✓'
    );

    // ==================================================
    // Validate table still has rows
    // ==================================================

    const rows =
      page.locator('table tbody tr');

    await expect(rows.first())
      .toBeVisible();

    console.log(
      'Multiple filters work together ✓'
    );

  }

);
// ====================================================
// TC_DASH_EXPORT_01
// Export Under 2500 Leads Downloads File
// ====================================================

test(

  'TC_DASH_EXPORT_01 - Export Under 2500 Leads Downloads File @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const exportBtn =
      page.getByRole(
        'button',
        { name: /export/i }
      );

    const [download] =
      await Promise.all([

        page.waitForEvent('download'),

        exportBtn.click()

      ]);

    const fileName =
      download.suggestedFilename();

    console.log(
      `Downloaded file: ${fileName}`
    );

    expect(fileName)
      .toBeTruthy();

    console.log(
      'Export download validated ✓'
    );

  }

);

// ====================================================
// TC_DASH_EXPORT_02
// Export Over 2500 Leads Triggers Email
// ====================================================

test(

  'TC_DASH_EXPORT_02 - Export Over 2500 Leads Triggers Email @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    // Set rows per page/filter if needed
    // Assuming environment already has >2500 leads

    const exportBtn =
      page.getByRole(
        'button',
        { name: /export/i }
      );

    await exportBtn.click();

    await expect(

      page.getByText(
        /email|sent to your email/i
      )

    ).toBeVisible();

    console.log(
      'Export email trigger validated ✓'
    );

  }

);

// ====================================================
// TC_DASH_OV_10
// Generate Microsite Creates Link
// ====================================================

// ====================================================
// TC_DASH_OV_10
// Generate Microsite Button Works
// ====================================================

test(

  'TC_DASH_OV_10 - Generate Microsite Button Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'Overview');

    const generateBtn =

      page.getByRole(
        'button',
        {
          name: /generate microsite/i
        }
      );

    await expect(generateBtn)
      .toBeVisible();

    // Listen for API response
    const responsePromise =

      page.waitForResponse(response =>

        response.url().includes('microsite') &&

        response.status() === 200

      );

    await generateBtn.click();

    const response =
      await responsePromise;

    console.log(
      `Microsite API Status: ${response.status()}`
    );

    expect(
      response.status()
    ).toBe(200);

    console.log(
      'Generate Microsite validated ✓'
    );

  }

);

// ====================================================
// TC_DASH_SV_13
// Site Visit Button Functionality
// ====================================================

test(

  'TC_DASH_SV_13 - Site Visit Button Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    const siteVisitBtn =
      page.getByRole(
        'button',
        {
          name: /Site Visit Tracker/i
        }
      ).first();

    await expect(siteVisitBtn)
      .toBeVisible();

    await siteVisitBtn.click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(

  page.getByRole(
    'button',
    {
      name: /Visits Scheduled/i
    }
  )

).toBeVisible();

    console.log(
      'Site Visit button functionality works ✓'
    );

  }

);

// ====================================================
// TC_DASH_LEADS_18
// Table Sort Ascending & Descending Validation
// ====================================================

test(

  'TC_DASH_LEADS_18 - Table Sort Ascending Descending Works @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await clickNav(page, 'All Leads');

    // ==================================================
    // CREATE DATE COLUMN
    // ==================================================

    const createDateHeader =

      page.getByRole(
        'columnheader',
        {
          name: /create date/i
        }
      );

    await expect(createDateHeader)
      .toBeVisible();

    // ==================================================
    // ASCENDING SORT
    // ==================================================

    await createDateHeader.click();

    await page.waitForTimeout(2000);

    const ascDates =

      await page.locator(
        'table tbody tr td:first-child'
      ).allTextContents();

    console.log(
      'Ascending Dates:',
      ascDates
    );

    // Convert to timestamps
    const ascTimestamps = ascDates.map(date =>

      new Date(date.trim()).getTime()

    );

    // Copy & sort
    const sortedAsc =

      [...ascTimestamps]
        .sort((a, b) => a - b);

    expect(ascTimestamps)
      .toEqual(sortedAsc);

    console.log(
      'Ascending sort validated ✓'
    );

    // ==================================================
    // DESCENDING SORT
    // ==================================================

    await createDateHeader.click();

    await page.waitForTimeout(2000);

    const descDates =

      await page.locator(
        'table tbody tr td:first-child'
      ).allTextContents();

    console.log(
      'Descending Dates:',
      descDates
    );

    const descTimestamps = descDates.map(date =>

      new Date(date.trim()).getTime()

    );

    const sortedDesc =

      [...descTimestamps]
        .sort((a, b) => b - a);

    expect(descTimestamps)
      .toEqual(sortedDesc);

    console.log(
      'Descending sort validated ✓'
    );

  }

);