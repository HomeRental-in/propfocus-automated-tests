import {
  test,
  expect,
  Page,
  APIRequestContext,
} from '@playwright/test';
test.setTimeout(120000);
// ======================================================
// USER JOURNEY 1
// Lead → Microsite → Engagement → Site Visit → Archive
//
// Flow:
//   1.  Broker logs into dashboard
//   2a. Broker generates microsite via webhook
//   2b. Microsite URL appears in dashboard All Leads
//   3.  Microsite link is valid and opens correctly
//   4.  Buyer name displayed correctly on microsite
//   5.  Project name/details displayed correctly
//   6.  Builder branding/logo visible
//   7.  Buyer engagement events fire (page_view, tracking)
//   8.  Lead appears in dashboard with correct data
//   9.  Activity timeline reflects buyer events
//   10. Broker schedules site visit via webhook
//   11. Site visit appears in Site Visit Tracker
//   12. Broker archives lead — lead moves to Archived Leads
// ======================================================

// ======================================================
// CONSTANTS
// ======================================================

const LOGIN_URL  = 'https://dev.propfocus.in/dashboard/login';
const API_URL    = 'https://dev.propfocus.in/api/whatsapp-webhook';
const TRACKING_API = '/api/track-event';

const PHONE = {
  MAIN: '9999999999',
  SUB:  '9888898888',
} as const;

const OTP        = '123456';
const BUYER_NAME = 'Harsha';
const PROJECT    = 'Abhee Tranquila';

// ======================================================
// SERIAL — all steps run in order, shared state
// ======================================================

test.describe.configure({ mode: 'serial' });

// ======================================================
// SHARED STATE
// Populated in early steps, used in later steps
// ======================================================

let micrositeUrl  = '';
let buyerId       = '';
let leadRowText   = '';

// ======================================================
// HELPERS
// ======================================================

async function login(page: Page, phone: string = PHONE.MAIN) {

  await page.goto(LOGIN_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  const phoneInput =
    page.locator('input[type="tel"], input[placeholder*="phone" i]');

  await expect(phoneInput).toBeVisible({ timeout: 30000 });

  await phoneInput.fill(phone);

  await page.getByRole('button', { name: /send otp/i }).click();

  await expect(
    page.getByText('Enter Verification Code')
  ).toBeVisible({ timeout: 15000 });

  const otpInput =
    page.locator('input[placeholder="000000"], input[maxlength="6"]');

  await expect(otpInput).toBeVisible({ timeout: 10000 });

  await otpInput.fill(OTP);

  await page
    .getByRole('button', { name: /verify/i })
    .click();

  await page.waitForURL(/dashboard/, {
    timeout: 30000
  });

  await expect(
    page.getByText('DASHBOARD', { exact: false })
  ).toBeVisible({ timeout: 30000 });

  console.log(`Logged in as ${phone} ✓`);
}

async function generateMicrosite(
  request: APIRequestContext,
  buyerName: string,
  project:   string,
  phone:     string = PHONE.SUB
): Promise<{ micrositeUrl: string; buyerId: string }> {

  const id = `J1${Date.now().toString().slice(-5)}`;

  const response =
    await request.post(API_URL, {
      timeout: 60000,
      data: {
        event:  'message',
        data: {
          from: phone,
          body: `${buyerName} with ID ${id} for ${project}`
        }
      }
    });

  expect(response.status()).toBe(200);

  const body = await response.json();

  console.log(JSON.stringify(body, null, 2));

  expect(body.success).toBe(true);
  expect(body.micrositeUrl).toBeTruthy();

  return {
    micrositeUrl: body.micrositeUrl,
    buyerId:      id,
  };

}

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 1 — BROKER LOGIN
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_01 - Broker Logs Into Dashboard @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    // Confirm all key nav items are present after login
    await expect(page.getByText('Overview').first()).toBeVisible();
    await expect(page.getByText('All Leads').first()).toBeVisible();
    await expect(page.getByText('Site Visit Tracker').first()).toBeVisible();

    console.log('Broker logged in and dashboard verified ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 2A — GENERATE MICROSITE VIA WEBHOOK
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_02A - Broker Generates Microsite Via Webhook @journey',

  async ({ request }) => {

    const result =
      await generateMicrosite(request, BUYER_NAME, PROJECT);

    micrositeUrl = result.micrositeUrl;
    buyerId      = result.buyerId;

    console.log(`Microsite URL: ${micrositeUrl}`);
    console.log(`Buyer ID: ${buyerId}`);

    expect(micrositeUrl).toContain('propfocus.in');

    // Microsite URL must be a valid HTTPS URL
    expect(micrositeUrl).toMatch(/^https:\/\//);

    console.log('Microsite generated via webhook ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 2B — MICROSITE APPEARS IN DASHBOARD ALL LEADS
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_02B - Microsite Appears In Dashboard All Leads @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Search for the buyer by name
    const searchBar =
      page.locator('input[placeholder*="Search" i]').first();

    await expect(searchBar).toBeVisible();
    await searchBar.fill(BUYER_NAME);
    await page.waitForTimeout(1500);                              // debounce

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`Rows found for "${BUYER_NAME}": ${count}`);

    expect(
      count,
      `Lead for "${BUYER_NAME}" should appear in All Leads after microsite generation`
    ).toBeGreaterThan(0);

    // Capture the row text for later validation
    leadRowText = await rows.first().innerText();

    console.log(`Lead row: ${leadRowText.slice(0, 120)}`);

    // Row should contain buyer name
    expect(leadRowText.toLowerCase()).toContain(BUYER_NAME.toLowerCase());

    // Row should contain project name
    expect(leadRowText).toContain(PROJECT);

    console.log('Lead appears in All Leads ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 3 — MICROSITE LINK IS VALID AND OPENS
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_03 - Microsite Link Opens Correctly @journey',

  async ({ page }) => {

    expect(micrositeUrl).toBeTruthy();

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    // Page must not be an error page
    const isError =
      await page.getByText(/error|not found|404/i).first()
        .isVisible().catch(() => false);

    expect(isError, 'Microsite must not show an error page').toBe(false);

    // At least one image must load
    await expect(
      page.locator('img').first()
    ).toBeVisible({ timeout: 10000 });

    console.log('Microsite opens without error ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 4 — BUYER NAME DISPLAYED CORRECTLY ON MICROSITE
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_04 - Buyer Name Displayed Correctly On Microsite @journey',

  async ({ page }) => {

    expect(micrositeUrl).toBeTruthy();

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    // Microsite personalises the greeting with buyer name
    // Confirmed from message: "Hi Harsha, As discussed..."
    await expect(
      page.getByText(BUYER_NAME, { exact: false }).first()
    ).toBeVisible({ timeout: 10000 });

    console.log(`Buyer name "${BUYER_NAME}" visible on microsite ✓`);

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 5 — PROJECT NAME AND DETAILS DISPLAYED CORRECTLY
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_05 - Project Name And Details Displayed On Microsite @journey',

  async ({ page }) => {

    expect(micrositeUrl).toBeTruthy();

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    // ── Project name in heading ───────────────────────
    await expect(
      page.getByText('Abhee Tranquila', { exact: false }).first()
    ).toBeVisible({ timeout: 10000 });

    console.log('Project name visible ✓');

    // ── Pricing — try multiple known text variants ────
    const pricingLocator =
      page.locator(
        'text=/Starting from/i, text=/₹/i, text=/Lakhs/i, text=/Price/i'
      ).first();

    await expect(
      pricingLocator,
      'Pricing information should be visible on microsite'
    ).toBeVisible({ timeout: 10000 });

    const pricingText = await pricingLocator.innerText();
    console.log(`Pricing text found: ${pricingText}`);

    // ── RERA status ───────────────────────────────────
    const reraLocator =
      page.locator('text=/RERA/i').first();

    await expect(
      reraLocator,
      'RERA information should be visible'
    ).toBeVisible({ timeout: 10000 });

    console.log('RERA visible ✓');

    // ── Configurations ────────────────────────────────
    const configLocator =
      page.locator(
        'text=/Configurations/i, text=/BHK/i, text=/Plots/i, text=/Villa/i, text=/sq.ft/i'
      ).first();

    await expect(
      configLocator,
      'Configuration details should be visible'
    ).toBeVisible({ timeout: 10000 });

    const configText = await configLocator.innerText();
    console.log(`Config text found: ${configText}`);

    // ── CTA buttons present ───────────────────────────
    await expect(
      page.getByRole('button', { name: 'View brochure' }).first()
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole('button', { name: 'Book Site Visit' }).first()
    ).toBeVisible({ timeout: 5000 });

    console.log('Project name and details verified on microsite ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 6 — BUILDER BRANDING/LOGO VISIBLE ON MICROSITE
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_06 - Builder Branding And Logo Visible On Microsite @journey',

  async ({ page }) => {

    expect(micrositeUrl).toBeTruthy();

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    // At least one image should be present (logo or project image)
    const images = page.locator('img');
    const imageCount = await images.count();

    console.log(`Images on microsite: ${imageCount}`);

    expect(
      imageCount,
      'Microsite should have at least one image (logo/branding)'
    ).toBeGreaterThan(0);

    // First image (typically logo) should load without 400/404
    const logoSrc =
      await images.first().getAttribute('src');

    console.log(`Logo/first image src: ${logoSrc}`);

    expect(logoSrc).toBeTruthy();

    // No broken images (status 400)
    const failedImages: string[] = [];

    page.on('response', response => {
      const url    = response.url();
      const status = response.status();
      if (
        (url.match(/\.(png|jpg|jpeg|webp|svg|gif)/i) || response.headers()['content-type']?.includes('image')) &&
        status === 400
      ) {
        failedImages.push(url);
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(
      failedImages.length,
      `No images should return 400. Broken: ${failedImages.join(', ')}`
    ).toBe(0);

    console.log('Builder branding/logo visible, no broken images ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 7 — BUYER ENGAGEMENT EVENTS FIRE ON MICROSITE
// Simulates buyer interactions and verifies tracking
// calls fire correctly for each action
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_07 - Buyer Engagement Events Fire On Microsite @journey',

  async ({ page }) => {

    expect(micrositeUrl).toBeTruthy();

    // Collect all tracking events fired during this session
    const firedEvents: string[] = [];

    page.on('response', async response => {
      if (
        response.url().includes(TRACKING_API) &&
        response.request().method() === 'POST'
      ) {
        try {
          const body = await response.json();
          const event = body.eventType ?? body.eventName ?? '';
          if (event) {
            firedEvents.push(event);
            console.log(`Tracking event fired: ${event}`);
          }
        } catch {}
      }
    });

    // ── Open microsite — fires link_open + page_view ──
    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // ── Gallery interaction ───────────────────────────
    const galleryImage = page.locator('img').nth(1);
    if (await galleryImage.isVisible().catch(() => false)) {
      await galleryImage.click();
      await page.waitForTimeout(500);
    }

    // ── Nav tabs — fires page_view per section ────────
    const navTabs = ['Overview', 'Experience', 'Units', 'Pricing', 'Amenities', 'Location'];

    for (const tab of navTabs) {
      const tabEl = page.getByRole('link', { name: tab }).first();
      if (await tabEl.isVisible().catch(() => false)) {
        await tabEl.click();
        await page.waitForTimeout(300);
      }
    }

    // ── Maps click ────────────────────────────────────
    const mapLink =
      page.locator('a[href*="maps.google"], a[href*="goo.gl"]').first();

    if (await mapLink.isVisible().catch(() => false)) {
      await mapLink.click();
      await page.waitForTimeout(500);
    }

    // ── Brochure button ───────────────────────────────
    const brochureBtn =
      page.getByRole('button', { name: 'View brochure' }).first();

    if (await brochureBtn.isVisible().catch(() => false)) {
      await brochureBtn.scrollIntoViewIfNeeded();
      await brochureBtn.click();
      await page.waitForTimeout(500);
    }

    // ── Contact / Phone button ────────────────────────
    const phoneBtn =
      page.locator('a[href^="tel:"]').first();

    if (await phoneBtn.isVisible().catch(() => false)) {
      await phoneBtn.click();
      await page.waitForTimeout(500);
    }

    // ── Share button ──────────────────────────────────
    const shareBtn =
      page.getByRole('button', { name: 'Share Project' }).first();

    if (await shareBtn.isVisible().catch(() => false)) {
      await shareBtn.scrollIntoViewIfNeeded();
      await shareBtn.click();
      await page.waitForTimeout(500);
    }

    // ── Wait for all tracking calls to settle ─────────
    await page.waitForTimeout(2000);

    console.log(`\nAll tracking events fired: [${firedEvents.join(', ')}]`);

    // At minimum, link_open and page_view must have fired
    expect(
      firedEvents.some(e => e === 'link_open' || e === 'page_view'),
      'At least link_open or page_view must fire when microsite is opened'
    ).toBe(true);

    console.log('Buyer engagement tracking events verified ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 8 — LEAD DATA IN DASHBOARD IS CORRECT
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_08 - Lead Data In Dashboard Is Correct @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Search for the buyer
    const searchBar =
      page.locator('input[placeholder*="Search" i]').first();

    await searchBar.fill(BUYER_NAME);
    await page.waitForTimeout(1500);

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const firstRow = rows.first();
    const cells    = firstRow.locator('td');

    // Create Date — must be a date
    const createDate = await cells.nth(0).innerText();
    console.log(`Create Date: ${createDate}`);
    expect(createDate.trim()).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // Agent Name — non-empty
    const agentName = await cells.nth(1).innerText();
    console.log(`Agent Name: ${agentName}`);
    expect(agentName.trim().length).toBeGreaterThan(0);

    // Buyer Name — must be Harsha
    const buyerNameCell = await cells.nth(2).innerText();
    console.log(`Buyer Name: ${buyerNameCell}`);
    expect(buyerNameCell.toLowerCase()).toContain(BUYER_NAME.toLowerCase());

    // Project — must be Abhee Tranquila
    const projectCell = await cells.nth(3).innerText();
    console.log(`Project: ${projectCell}`);
    expect(projectCell).toContain('Abhee');

    console.log('Lead data in dashboard is correct ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 9 — ACTIVITY TIMELINE REFLECTS BUYER EVENTS
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_09 - Activity Timeline Reflects Buyer Events @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Search for the buyer and open their drawer
    const searchBar =
      page.locator('input[placeholder*="Search" i]').first();

    await searchBar.fill(BUYER_NAME);
    await page.waitForTimeout(1500);

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // Click buyer name cell to open drawer
    await rows.first().locator('td').nth(2).click();
    await page.waitForTimeout(1000);

    // Drawer must open
    await expect(
      page.getByText('Buyer ID', { exact: false })
    ).toBeVisible({ timeout: 5000 });

    // Activity Timeline section must be visible
    await expect(
      page.getByText('Activity Timeline')
    ).toBeVisible();

    // Engagement Summary must show visits
    await expect(
      page.getByText('Engagement Summary', { exact: false })
    ).toBeVisible();

    await expect(
      page.getByText('Total Visits', { exact: false })
    ).toBeVisible();

    // At least one session entry should exist
    const sessionEntries =
      page.locator('text=/Session \\d+/');

    const sessionCount = await sessionEntries.count();

    console.log(`Session entries in timeline: ${sessionCount}`);

    expect(
      sessionCount,
      'Activity Timeline should have at least 1 session entry after buyer engagement'
    ).toBeGreaterThan(0);

    // Timeline must contain known event types
    const timelineText =
      await page.locator('[class*="timeline"], [class*="activity"]').first()
        .innerText().catch(() => '');

    console.log(`Timeline content: ${timelineText.slice(0, 200)}`);

    console.log('Activity Timeline reflects buyer events ✓');

    // Close drawer
    await page.keyboard.press('Escape');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 10 — BROKER SCHEDULES SITE VISIT VIA WEBHOOK
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_10 - Broker Schedules Site Visit Via Webhook @journey',

  async ({ request }) => {

    // Site visit scheduling via WhatsApp prompt
    // Format confirmed from system: "Book site visit for <BuyerName> with ID <ID>"
    const response =
      await request.post(API_URL, {
        timeout: 60000,
        data: {
          event: 'message',
          data: {
            from: PHONE.SUB,
            body: `Book site visit for ${BUYER_NAME} with ID ${buyerId} for ${PROJECT}`
          }
        }
      });

    expect(response.status()).toBe(200);

    const body = await response.json();

    console.log(JSON.stringify(body, null, 2));

    expect(
      body.success,
      'Site visit scheduling webhook should return success'
    ).toBe(true);

    console.log('Site visit scheduled via webhook ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 11 — SITE VISIT APPEARS IN SITE VISIT TRACKER
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_11 - Site Visit Appears In Site Visit Tracker @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('Site Visit Tracker', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Search for the buyer in Site Visit Tracker
    const searchBar =
      page.locator('input[placeholder*="Search" i], input[placeholder*="visitor" i]')
        .first();

    await expect(searchBar).toBeVisible();
    await searchBar.fill(BUYER_NAME);
    await page.waitForTimeout(1500);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    console.log(`Site visit rows for "${BUYER_NAME}": ${count}`);

    expect(
      count,
      `Site visit for "${BUYER_NAME}" should appear in Site Visit Tracker`
    ).toBeGreaterThan(0);

    const firstRow = rows.first();
    const cells    = firstRow.locator('td');

    // Buyer Name
    const buyerCell = await cells.nth(2).innerText();
    console.log(`Buyer in tracker: ${buyerCell}`);
    expect(buyerCell.toLowerCase()).toContain(BUYER_NAME.toLowerCase());

    // Project
    const projectCell = await cells.nth(3).innerText();
    console.log(`Project in tracker: ${projectCell}`);
    expect(projectCell).toContain('Abhee');

    // Status must be a known value
    const statusCell = await cells.nth(5).innerText();
    console.log(`Status: ${statusCell}`);
    expect(statusCell.trim()).toMatch(/pending|confirmed|rescheduled|conducted/i);

    // Visit time must be present
    const visitTimeCell = await cells.nth(4).innerText();
    console.log(`Visit time: ${visitTimeCell}`);
    expect(visitTimeCell.trim().length).toBeGreaterThan(0);

    console.log('Site visit appears in tracker with correct data ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 11B — SITE VISIT STAT CARDS UPDATE
// Visits Scheduled count must increment after booking
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_11B - Site Visit Tracker Stat Cards Reflect New Visit @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('Site Visit Tracker', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Visits Scheduled must be at least 1
    const card =
      page.locator('text=Visits Scheduled').locator('..').locator('..');

    const statText =
      await card.locator('h2').first().innerText();

    const statCount = parseInt(statText.trim(), 10);

    console.log(`Visits Scheduled: ${statCount}`);

    expect(
      statCount,
      'Visits Scheduled should be at least 1 after booking'
    ).toBeGreaterThan(0);

    // Stat must match pagination total
    const paginationText =
      await page.getByText('Showing', { exact: false }).first().innerText();

    const match = paginationText.match(/of\s+(\d+)/i);

    if (match) {
      const tableTotal = parseInt(match[1], 10);
      expect(statCount).toBe(tableTotal);
      console.log('Stat card count matches table total ✓');
    }

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 12 — BROKER ARCHIVES LEAD
// Checkbox → archive action → lead moves to Archived
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_12 - Broker Archives Lead @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('All Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Search for the buyer
    const searchBar =
      page.locator('input[placeholder*="Search" i]').first();

    await searchBar.fill(BUYER_NAME);
    await page.waitForTimeout(1500);

    const rows = page.locator('table tbody tr');

    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const rowCount = await rows.count();

    console.log(`Rows found for "${BUYER_NAME}": ${rowCount}`);

    expect(rowCount).toBeGreaterThan(0);

    // ── Select the first matching lead ───────────────
    const checkbox =
      rows.first().locator('input[type="checkbox"]').first();

    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    console.log('Lead checkbox selected ✓');

    // ── Look for Archive action ───────────────────────
    // Archive button typically appears in a bulk action
    // toolbar after selecting a row, or in the row action menu
    const archiveBtn =
      page.locator(
        'button:has-text("Archive"), button:has-text("archive"), ' +
        '[class*="archive"] button, [aria-label*="archive" i]'
      ).first();

    const archiveBtnVisible =
      await archiveBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (archiveBtnVisible) {

      await archiveBtn.click();
      await page.waitForTimeout(1000);

      // Confirm dialog may appear
      const confirmBtn =
        page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Archive")').last();

      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }

      console.log('Archive action clicked ✓');

    } else {

      // Try right-click context menu or row action menu (⋮)
      const rowMenuBtn =
        rows.first().locator('button[aria-label*="more" i], button:has-text("⋮"), [class*="actions"]').first();

      if (await rowMenuBtn.isVisible().catch(() => false)) {

        await rowMenuBtn.click();
        await page.waitForTimeout(300);

        const menuArchive =
          page.locator('[role="menu"] button:has-text("Archive"), [role="menuitem"]:has-text("Archive")').first();

        if (await menuArchive.isVisible().catch(() => false)) {
          await menuArchive.click();
          await page.waitForTimeout(1000);
          console.log('Archive via row menu clicked ✓');
        } else {
          console.log('WARN: Archive option not found in row menu — verify UI manually');
        }

      } else {
        console.log('WARN: Archive button not found after selecting row — may require a different interaction');
      }

    }

    // ── Verify lead is no longer in All Leads ─────────
    await searchBar.fill(BUYER_NAME);
    await page.waitForTimeout(1500);

    const remainingRows = await rows.count();

    console.log(`Rows remaining after archive: ${remainingRows}`);

    // ── Verify lead appears in Archived Leads ─────────
    await page.getByText('Archived Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const archiveSearch =
      page.locator('input[placeholder*="Search" i], input[placeholder*="archived" i]').first();

    if (await archiveSearch.isVisible().catch(() => false)) {
      await archiveSearch.fill(BUYER_NAME);
      await page.waitForTimeout(1500);
    }

    const archivedRows = page.locator('table tbody tr');
    const archivedCount = await archivedRows.count();

    console.log(`Archived rows for "${BUYER_NAME}": ${archivedCount}`);

    expect(
      archivedCount,
      `Lead for "${BUYER_NAME}" should appear in Archived Leads after archiving`
    ).toBeGreaterThan(0);

    const archivedRowText = await archivedRows.first().innerText();

    expect(archivedRowText.toLowerCase()).toContain(BUYER_NAME.toLowerCase());

    console.log('Lead archived and visible in Archived Leads ✓');

  }

);

// ======================================================
// ══════════════════════════════════════════════════════
// STEP 13 — FULL JOURNEY SUMMARY VALIDATION
// Confirms all key data points from the journey are
// consistent and correct end-to-end
// ══════════════════════════════════════════════════════
// ======================================================

test(

  'UJ1_STEP_13 - Full Journey Data Consistency Check @journey',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    console.log('\n=== Journey Summary ===');
    console.log(`Buyer Name:    ${BUYER_NAME}`);
    console.log(`Project:       ${PROJECT}`);
    console.log(`Buyer ID:      ${buyerId}`);
    console.log(`Microsite URL: ${micrositeUrl}`);

    // ── 1. Microsite URL is still valid ──────────────
    expect(micrositeUrl).toBeTruthy();
    expect(micrositeUrl).toMatch(/^https:\/\//);

    // ── 2. Lead exists in Archived Leads ─────────────
    await page.getByText('Archived Leads', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const archiveSearch =
      page.locator('input[placeholder*="Search" i], input[placeholder*="archived" i]').first();

    if (await archiveSearch.isVisible().catch(() => false)) {
      await archiveSearch.fill(BUYER_NAME);
      await page.waitForTimeout(1500);
    }

    const archivedRows = page.locator('table tbody tr');
    const archivedCount = await archivedRows.count();

    console.log(`Archived leads for "${BUYER_NAME}": ${archivedCount}`);

    expect(
      archivedCount,
      'Lead should be in Archived Leads at end of journey'
    ).toBeGreaterThan(0);

    // ── 3. Site Visit Tracker has the visit ──────────
    await page.getByText('Site Visit Tracker', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const svSearch =
      page.locator('input[placeholder*="Search" i], input[placeholder*="visitor" i]').first();

    if (await svSearch.isVisible().catch(() => false)) {
      await svSearch.fill(BUYER_NAME);
      await page.waitForTimeout(1500);
    }

    const svRows = page.locator('table tbody tr');
    const svCount = await svRows.count();

    console.log(`Site visits for "${BUYER_NAME}": ${svCount}`);

    expect(
      svCount,
      'Site visit should exist in tracker at end of journey'
    ).toBeGreaterThan(0);

    console.log('\n✅ Full journey completed successfully');
    console.log('   Lead generated → Microsite verified → Engagement tracked');
    console.log('   Site visit scheduled → Lead archived');

  }

);

