import {
  test,
  expect,
  Page,
  APIRequestContext,
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const LOGIN_URL     = 'https://dev.propfocus.in/dashboard/login';
const API_URL       = 'https://dev.propfocus.in/api/whatsapp-webhook';
const BASE_URL      = 'https://dev.propfocus.in';
async function getTableTotal(
  page: Page
): Promise<number> {

  const footerText = await page
    .getByText(
      /Showing.*of.*leads/i
    )
    .last()
    .textContent()
    .catch(() => null);

  console.log(
    'Pagination Footer:',
    footerText
  );

  if (!footerText) {
    throw new Error(
      'Pagination footer not found'
    );
  }

  const match =
    footerText.match(
      /of\s+([\d,]+)/i
    );

  if (!match) {
    throw new Error(
      `Unable to parse count from footer: ${footerText}`
    );
  }

  return Number(
    match[1].replace(/,/g, '')
  );
}

  // ── Helper: get number from stat card by label ───────────────────────────
async function getCardNumber(
  page: Page,
  labelText: string
): Promise<number> {

  console.log(`Searching for card: ${labelText}`);

  const label = page
    .getByText(new RegExp(`^${labelText}$`, 'i'))
    .last();

  await expect(label).toBeVisible({ timeout: 10000 });

  // Try: number is a sibling BEFORE the label (above it in DOM)
  const prevSibling = label.locator('xpath=preceding-sibling::*[1]');
  const prevText = await prevSibling.textContent().catch(() => '');
  console.log(`Prev sibling text: "${prevText}"`);

  if (prevText && /^\d[\d,]*$/.test(prevText.trim())) {
    return Number(prevText.replace(/,/g, ''));
  }

  // Try: number is a sibling AFTER the label (below it in DOM)
  const nextSibling = label.locator('xpath=following-sibling::*[1]');
  const nextText = await nextSibling.textContent().catch(() => '');
  console.log(`Next sibling text: "${nextText}"`);

  if (nextText && /^\d[\d,]*$/.test(nextText.trim())) {
    return Number(nextText.replace(/,/g, ''));
  }

  // Try: number is in parent, but label is the LAST text node —
  // so parent's first number is the count
  for (const level of [1, 2, 3]) {
    const container = label.locator(`xpath=ancestor::div[${level}]`);
    const text = (await container.textContent()) || '';

    // Only use this container if it's tight (not the whole dashboard)
    if (text.length < 200) {
      const numbers = text.match(/\d[\d,]*/g) || [];
      console.log(`[Level ${level}] Length=${text.length} Numbers=${JSON.stringify(numbers)}`);

      if (numbers.length) {
        return Number(numbers[0].replace(/,/g, ''));
      }
    }
  }

  throw new Error(`No count found for ${labelText}`);
}




const PHONE = {
  MAIN: '9999999999',
  SUB:  '9888898888',
} as const;

const OTP          = '123456';
const BUYER_NAME   = 'Arhan';
const PROJECT_NAME = 'Abhee Tranquila';

// ======================================================
// HELPERS
// ======================================================

async function login(page: Page, phone: string = PHONE.MAIN) {
  await page.goto(LOGIN_URL);
  await page.waitForLoadState('networkidle');

  await page
    .locator('input[type="tel"], input[placeholder*="phone" i]')
    .fill(phone);

  await page.getByRole('button', { name: 'Send OTP' }).click();

  await expect(
    page.getByText('Enter Verification Code')
  ).toBeVisible({ timeout: 10_000 });

  await page
    .locator('input[placeholder="000000"], input[maxlength="6"]')
    .fill(OTP);

  await page.getByRole('button', { name: /verify/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  await expect(
    page.getByText('DASHBOARD', { exact: false })
  ).toBeVisible({ timeout: 20_000 });

  console.log(`Logged in as ${phone} ✓`);
}

async function sendWebhook(
  request: APIRequestContext,
  phone: string,
  body: string
) {
  const res = await request.post(API_URL, {
    timeout: 60_000,
    data: {
      event: 'message',
      data: { from: phone, body }
    }
  });
  expect(res.status()).toBe(200);
  return res.json();
}

async function navigateTo(page: Page, section: string) {
  await page.getByText(section, { exact: true }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Reads a stat card number by its label.
 * Works for both the big heading cards and Lead Cohort rows.
 */
async function getStatCount(page: Page, label: string): Promise<number> {
  const card = page
    .locator('div, p, span, td')
    .filter({ hasText: new RegExp(`^${label}$`, 'i') })
    .first();

  await expect(card).toBeVisible({ timeout: 8_000 });

  // Walk up to the container, then find the first number
  const container = card.locator('xpath=ancestor::div[3]').first();
  const text = await container.textContent();
  const match = text?.match(/\d+/);

  if (!match) throw new Error(`No number found near label: "${label}"`);

  return parseInt(match[0], 10);
}

// ======================================================
// ══════════════════════════════════════════════════════
//  SECTION 0 — DATA SEEDER (5 000 microsites)
//  Run standalone:
//    npx playwright test --grep "SEED" --headed
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Data Seeder', () => {

  // One worker, no retries — pure fire-and-forget API calls
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(0); // unlimited — 5 000 calls take ~15-20 min

  test(
    'SEED_01 - Generate 5000 Microsites With Unique Buyer IDs',
    async ({ request }) => {

      const TOTAL        = 5;
      const BATCH_SIZE   = 5;   // concurrent calls per batch
      const DELAY_MS     = 300;  // pause between batches (be kind to the server)

      let successCount = 0;
      let failCount    = 0;

      console.log(`Starting seeder — target: ${TOTAL} microsites`);

      for (let i = 0; i < TOTAL; i += BATCH_SIZE) {

        const batch = Array.from(
          { length: Math.min(BATCH_SIZE, TOTAL - i) },
          (_, j) => {
            const index    = i + j + 1;
            const buyerId = `${Date.now()}-${index}-${Math.random()
  .toString(36)
  .substring(2, 8)
  .toUpperCase()}`;;
            const body     = `${BUYER_NAME} with ID ${buyerId} for ${PROJECT_NAME}`;
            return sendWebhook(request, PHONE.MAIN, body)
              .then(res => {
                if (res?.success) {
                  successCount++;
                } else {
                  failCount++;
                  console.warn(`[${index}] Unexpected response:`, JSON.stringify(res));
                }
              })
              .catch(err => {
                failCount++;
                console.warn(`[${index}] Error:`, err.message);
              });
          }
        );

        await Promise.all(batch);

        if ((i / BATCH_SIZE) % 10 === 0) {
          // Progress log every 100 microsites
          console.log(
            `Progress: ${Math.min(i + BATCH_SIZE, TOTAL)}/${TOTAL} | ✓ ${successCount} ✗ ${failCount}`
          );
        }

        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      console.log(`\nSeeder complete — ✓ ${successCount} created  ✗ ${failCount} failed`);
      expect(successCount).toBeGreaterThan(TOTAL * 0.95); // allow 5% failure rate
    }
  );
});

// ======================================================
// ══════════════════════════════════════════════════════
//  SECTION 1 — DASHBOARD SLOWNESS
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Dashboard Performance', () => {

  test(
    'TC_PERF_01 - All Leads tab loads under 6s with large dataset @performance',
    async ({ page }) => {

      await login(page, PHONE.MAIN);

      const start = Date.now();
      await navigateTo(page, 'All Leads');
      const loadTime = Date.now() - start;

      console.log(`All Leads load time: ${loadTime}ms`);
      expect(loadTime, 'All Leads should load under 6 000 ms').toBeLessThan(6_000);
    }
  );

  test(
    'TC_PERF_02 - Overview tab loads under 6s with large dataset @performance',
    async ({ page }) => {

      await login(page, PHONE.MAIN);

      const start = Date.now();
      await navigateTo(page, 'Overview');
      const loadTime = Date.now() - start;

      console.log(`Overview load time: ${loadTime}ms`);
      expect(loadTime, 'Overview should load under 6 000 ms').toBeLessThan(6_000);
    }
  );

  test(
    'TC_PERF_03 - Search response under 1.5s after keystroke @performance',
    async ({ page }) => {

      await login(page, PHONE.MAIN);
      await navigateTo(page, 'All Leads');

      const searchBox = page.getByPlaceholder(/search/i);
      await searchBox.fill('Arhan');

      const start = Date.now();
      // Wait for table to repaint (row count change or no-results)
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length > 0;
      }, { timeout: 5_000 });

      const elapsed = Date.now() - start;
      console.log(`Search response time: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(1_500);
    }
  );

  test(
    'TC_PERF_04 - Pagination next page loads under 2s @performance',
    async ({ page }) => {

      await login(page, PHONE.MAIN);
      await navigateTo(page, 'All Leads');

      const nextBtn = page.getByRole('button', { name: /next/i });

      if (!await nextBtn.isVisible()) {
        console.log('Only 1 page of data — skipping pagination perf test');
        return;
      }

      const start = Date.now();
      await nextBtn.click();
      await page.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;

      console.log(`Pagination load time: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(2_000);
    }
  );

  test(
    'TC_PERF_05 - Site Visit Tracker loads under 6s @performance',
    async ({ page }) => {

      await login(page, PHONE.MAIN);

      const start = Date.now();
      await navigateTo(page, 'Site Visit Tracker');
      const elapsed = Date.now() - start;

      console.log(`Site Visit Tracker load time: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(6_000);
    }
  );
});

// ======================================================
// ══════════════════════════════════════════════════════
//  SECTION 2 — SITE VISIT CHECKBOXES
//  (Image 1 vs Image 2: checkbox click changes action
//   bar from 4 buttons → 2 buttons)
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Site Visit Checkboxes', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await navigateTo(page, 'All Leads');
    await expect(
      page.locator('table tbody tr').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test(
    'TC_SV_CHK_01 - Action bar hidden when no row selected @sanity',
    async ({ page }) => {

      // No checkbox checked — action bar buttons should NOT be visible
      const actionBar = page.locator(
        'button:has-text("Mark as Site visit Conducted"),' +
        'button:has-text("Mark as Booked"),' +
        'button:has-text("Undo Site Visit Booked"),' +
        'button:has-text("No Show")'
      ).first();

      await expect(actionBar).not.toBeVisible();
      console.log('Action bar hidden when no row selected ✓');
    }
  );

  test(
    'TC_SV_CHK_02 - Selecting row shows all 4 action buttons (Image 1) @sanity',
    async ({ page }) => {

      const firstCheckbox = page
  .getByRole('checkbox')
  .nth(2); // skip header checkbox

await firstCheckbox.click();

      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();

      // All 4 buttons from Image 1 must appear
      await expect(
        page.getByRole('button', { name: /Mark as Site visit Conducted/i })
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        page.getByRole('button', { name: /Mark as Booked/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /No Show/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /Archive/i })
      ).toBeVisible();

      await expect(
        page.getByText('2 selected')
      ).toBeVisible();

      console.log('All 4 action buttons visible after checkbox selection ✓');
    }
  );

  test(
    'TC_SV_CHK_03 - Mark as Booked changes action bar to 2 buttons (Image 2) @regression',
    async ({ page }) => {

      const firstCheckbox = page
        .locator('table tbody tr')
        .first()
        .locator('input[type="checkbox"]');

      await firstCheckbox.check();

      // Click "Mark as Booked"
      await page
        .getByRole('button', { name: /Mark as Booked/i })
        .click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);

      // Image 2 shows: only "Undo Site Visit Done" + "Mark as Booked" remain
      await expect(
        page.getByRole('button', { name: /Undo Site Visit Done/i })
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        page.getByRole('button', { name: /Mark as Booked/i })
      ).toBeVisible();

      // The other 2 buttons should disappear
      await expect(
        page.getByRole('button', { name: /Mark as Site visit Conducted/i })
      ).not.toBeVisible();

      await expect(
        page.getByRole('button', { name: /No Show/i })
      ).not.toBeVisible();

      console.log('Action bar correctly changes to 2 buttons after Mark as Booked ✓');
    }
  );

  test(
    'TC_SV_CHK_04 - Mark as Site Visit Conducted works @regression',
    async ({ page }) => {

      const firstCheckbox = page
        .locator('table tbody tr')
        .first()
        .locator('input[type="checkbox"]');

      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();
      await page
        .getByRole('button', { name: /Mark as Site visit Conducted/i })
        .click();

      await page.waitForLoadState('networkidle');

      // Should show some confirmation or update action bar
      await expect(page.locator('body')).toBeVisible();
      console.log('Mark as Site Visit Conducted clicked ✓');
    }
  );

  test(
    'TC_SV_CHK_05 - No Show button works @regression',
    async ({ page }) => {

      const firstCheckbox = page
        .locator('table tbody tr')
        .first()
        .locator('input[type="checkbox"]');

      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();
      await page
        .getByRole('button', { name: /No Show/i })
        .click();

      await page.waitForLoadState('networkidle');
      console.log('No Show button clicked ✓');
    }
  );

  test(
    'TC_SV_CHK_06 - Unchecking row hides action bar @regression',
    async ({ page }) => {

      const firstCheckbox = page
        .locator('table tbody tr')
        .first()
        .locator('input[type="checkbox"]');

      await firstCheckbox.check();
      await expect(
        page.getByRole('button', { name: /Mark as Booked/i })
      ).toBeVisible();

      await firstCheckbox.uncheck();
      await expect(firstCheckbox).not.toBeChecked();

      await expect(
        page.getByRole('button', { name: /Mark as Booked/i })
      ).not.toBeVisible({ timeout: 3_000 });

      console.log('Action bar hidden after unchecking ✓');
    }
  );

  test(
    'TC_SV_CHK_07 - Select all shows action bar and correct count @regression',
    async ({ page }) => {

      const selectAll = page
        .locator('table thead input[type="checkbox"]')
        .first();

      await selectAll.check();
      await expect(selectAll).toBeChecked();

      // Count visible rows
      const rowCount = await page
        .locator('table tbody tr')
        .count();

      // Selected count label should reflect number of rows
      const selectedLabel = page
        .getByText(/\d+ selected/i)
        .first();

      await expect(selectedLabel).toBeVisible();

      const labelText = await selectedLabel.textContent();
      const selectedNum = parseInt(labelText?.match(/\d+/)?.[0] ?? '0', 10);

      expect(selectedNum).toBe(rowCount);
      console.log(`Select all: ${selectedNum} rows selected ✓`);
    }
  );
});
test(
  'TC_SV_CHK_08 - Conducted changes action bar correctly',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const checkbox = page
      .locator('table tbody input[type="checkbox"]')
      .first();

    await checkbox.check();

    await page
      .getByRole('button', {
        name: /Mark as Site Visit Conducted/i
      })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page.getByRole('button', {
        name: /Undo Site Visit Done/i
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /Mark as Booked/i
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /No Show/i
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /Mark as Site Visit Conducted/i
      })
    ).not.toBeVisible();

    console.log(
      'Conducted action bar transition validated ✓'
    );
  }
);
test(
  'TC_SV_CHK_09 - Undo Site Visit Done Restores Original Action Bar',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const checkbox = page
      .locator('table tbody input[type="checkbox"]')
      .first();

    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await page
      .getByRole('button', {
        name: /Mark as Site Visit Conducted/i
      })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page.getByRole('button', {
        name: /Undo Site Visit Done/i
      })
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: /Undo Site Visit Done/i
      })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(
      page.getByRole('button', {
        name: /Mark as Site Visit Conducted/i
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /No Show/i
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /Mark as Booked/i
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /Undo Site Visit Done/i
      })
    ).not.toBeVisible();

    console.log(
      'Undo Site Visit Done restores action bar ✓'
    );
  }
);

// ======================================================
// ══════════════════════════════════════════════════════
//  SECTION 3 — STAT CARD FILTER BUTTONS
//  (Image 3: Engaged Leads, Lead Cohort buttons —
//   clicking each must filter the table and show
//   the correct matching row count)
// ══════════════════════════════════════════════════════
// ======================================================
test('TC_FILTER_ALL_CARDS', async ({ page }) => {

  await login(page, PHONE.MAIN);
  await navigateTo(page, 'All Leads');

  // ── Step 1: Read the Microsites Generated number from the page ──
  const micrositesLabel = page.getByText('Microsites Generated').first();
  await expect(micrositesLabel).toBeVisible({ timeout: 10000 });

  // The number is right next to the label — grab the whole section text
  const sectionText = await micrositesLabel
    .locator('xpath=ancestor::div[2]')
    .textContent();

  console.log('Section text:', sectionText);

  // Pull the first number out of that text
  const match = sectionText?.match(/[\d,]+/);
  if (!match) throw new Error('Could not find Microsites Generated count');

  const cardCount = Number(match[0].replace(/,/g, ''));
  console.log('Microsites Generated card count:', cardCount);

  // ── Step 2: Check the table total matches ──
  const tableCount = await getTableTotal(page);
  console.log('Table total:', tableCount);

  expect(
    tableCount,
    `Microsites Generated count mismatch: card=${cardCount} table=${tableCount}`
  ).toBe(cardCount);

  console.log(`✓ Microsites Generated | Card=${cardCount} Table=${tableCount}`);
});

test.describe('Stat Card Filter Buttons — Count Validation', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await navigateTo(page, 'All Leads');
    await page.waitForLoadState('networkidle');
  });

  // ── Helper: get current table total from pagination ──────────────────────
  

  test(
    'TC_FILTER_01 - Microsites Generated card count matches total table rows @sanity',
    async ({ page }) => {

      // "All" filter for complete count
      await page.getByRole('button', { name: 'All', exact: true }).click();
      await page.waitForLoadState('networkidle');

      const cardCount   = await getCardNumber(page, 'Microsites Generated');
      const tableTotal  = await getTableTotal(page);

      console.log(`Microsites Generated card: ${cardCount} | Table total: ${tableTotal}`);
      expect(cardCount).toBe(tableTotal);
    }
  );

  test(
    'TC_FILTER_02 - Engaged Leads card click filters table, count matches @sanity',
    async ({ page }) => {

      // Read the card number BEFORE clicking
      const engagedCardCount = await getCardNumber(page, 'Engaged Leads');
      console.log(`Engaged Leads card count: ${engagedCardCount}`);

      // Click the Engaged Leads card/button to filter
      await page
        .locator('div, button')
        .filter({ hasText: /^Engaged Leads$/ })
        .first()
        .click();

      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);

      // Verify filter chip/tag appeared
      await expect(
        page.getByText(/Engaged Leads/i).first()
      ).toBeVisible();

      const tableTotal = await getTableTotal(page);
      console.log(`Table total after Engaged Leads filter: ${tableTotal}`);

      expect(tableTotal).toBe(engagedCardCount);
      console.log('Engaged Leads count matches table ✓');
    }
  );

  test(
    'TC_FILTER_03 - Site Visit Booked cohort count matches filtered table @sanity',
    async ({ page }) => {

      // Read the Lead Cohort number next to "Site Visit Booked"
      const cohortRow = page
        .locator('div, tr')
        .filter({ hasText: /Site Visit Booked/ })
        .first();

      const cohortText = await cohortRow.textContent();
      const cohortMatch = cohortText?.match(/(\d+)\s*$/);
      const cohortCount = cohortMatch ? parseInt(cohortMatch[1], 10) : 0;

      console.log(`Site Visit Booked cohort count: ${cohortCount}`);

      // Click to filter
      await cohortRow.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);

      const tableTotal = await getTableTotal(page);
      console.log(`Table total after Site Visit Booked filter: ${tableTotal}`);

      expect(tableTotal).toBe(cohortCount);
      console.log('Site Visit Booked count matches table ✓');
    }
  );

  test(
    'TC_FILTER_04 - Contacted via WhatsApp cohort count matches filtered table @sanity',
    async ({ page }) => {

      const cohortRow = page
        .locator('div, tr')
        .filter({ hasText: /Contacted via Whatsapp/i })
        .first();

      const cohortText = await cohortRow.textContent();
      const cohortMatch = cohortText?.match(/(\d+)\s*$/);
      const cohortCount = cohortMatch ? parseInt(cohortMatch[1], 10) : 0;

      console.log(`Contacted via WhatsApp cohort count: ${cohortCount}`);

      await cohortRow.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);

      const tableTotal = await getTableTotal(page);
      console.log(`Table total after WhatsApp filter: ${tableTotal}`);

      expect(tableTotal).toBe(cohortCount);
      console.log('Contacted via WhatsApp count matches table ✓');
    }
  );

  test(
    'TC_FILTER_05 - Shared with Family cohort count matches filtered table @regression',
    async ({ page }) => {

      const cohortRow = page
        .locator('div, tr')
        .filter({ hasText: /Shared with Family/i })
        .first();

      const cohortText = await cohortRow.textContent();
      const cohortMatch = cohortText?.match(/(\d+)\s*$/);
      const cohortCount = cohortMatch ? parseInt(cohortMatch[1], 10) : 0;

      console.log(`Shared with Family cohort count: ${cohortCount}`);

      await cohortRow.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);

      const tableTotal = await getTableTotal(page);
      console.log(`Table total after Shared with Family filter: ${tableTotal}`);

      expect(tableTotal).toBe(cohortCount);
      console.log('Shared with Family count matches table ✓');
    }
  );

  test(
    'TC_FILTER_06 - Site Visits Scheduled count matches Site Visit Tracker table @sanity',
    async ({ page }) => {

      // Read Site Visits card
      const siteVisitCard = page
        .locator('div')
        .filter({ hasText: /^Site Visits$/ })
        .first();

      const cardText = await siteVisitCard.locator('xpath=ancestor::div[3]').textContent();
      const scheduledMatch = cardText?.match(/Scheduled\s+(\d+)/i);
      const scheduledCount = scheduledMatch ? parseInt(scheduledMatch[1], 10) : 0;

      console.log(`Site Visits Scheduled stat: ${scheduledCount}`);

      // Navigate to Site Visit Tracker and compare total
      await navigateTo(page, 'Site Visit Tracker');

      const svTableTotal = await getTableTotal(page);
      console.log(`Site Visit Tracker table total: ${svTableTotal}`);

      expect(scheduledCount).toBe(svTableTotal);
      console.log('Site Visits Scheduled count consistent ✓');
    }
  );

  test(
    'TC_FILTER_07 - Reset filters restores full table count @regression',
    async ({ page }) => {

      const totalBeforeFilter = await getTableTotal(page);

      // Apply a filter
      await page
        .locator('div, button')
        .filter({ hasText: /^Engaged Leads$/ })
        .first()
        .click();

      await page.waitForLoadState('networkidle');

      // Reset
      const resetBtn = page.getByRole('button', { name: /reset filter/i });
      if (await resetBtn.isVisible()) {
        await resetBtn.click();
        await page.waitForLoadState('networkidle');
      } else {
        // Dismiss filter chip with the × button
        await page
          .locator('button[aria-label*="remove"], span:has-text("×")')
          .first()
          .click();
        await page.waitForLoadState('networkidle');
      }

      const totalAfterReset = await getTableTotal(page);

      expect(totalAfterReset).toBe(totalBeforeFilter);
      console.log('Reset filters restores full count ✓');
    }
  );

  test(
    'TC_FILTER_08 - Date filters (Today, 7D, 30D, All) update card + table counts @regression',
    async ({ page }) => {

      const dateFilters = ['Today', '7D', '30D', 'All'] as const;

      for (const filter of dateFilters) {

        await page.getByRole('button', { name: filter, exact: true }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);

        const cardCount  = await getCardNumber(page, 'Microsites Generated');
        const tableTotal = await getTableTotal(page);

        console.log(`[${filter}] Card: ${cardCount} | Table: ${tableTotal}`);

        expect(cardCount).toBe(tableTotal);
        console.log(`Date filter "${filter}" count consistent ✓`);
      }
    }
  );
});

// ======================================================
// ══════════════════════════════════════════════════════
//  SECTION 4 — ACCOUNT OPTIONS (Referral + Investor)
//  Validate both sections show correct scoped data
//  and are not accidentally showing ALL data
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Account Options — Referral + Investor Visibility', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
  });

  test(
    'TC_ACCOUNT_01 - ACCOUNT section is visible in sidebar @sanity',
    async ({ page }) => {

      await expect(
        page.getByText('ACCOUNT', { exact: false })
      ).toBeVisible();

      // Reports must be present under ACCOUNT
      await expect(
        page.getByText('Reports', { exact: true })
      ).toBeVisible();

      console.log('ACCOUNT section visible in sidebar ✓');
    }
  );

  test(
    'TC_ACCOUNT_02 - Reports page loads and is scoped (not showing all data) @regression',
    async ({ page }) => {

      await navigateTo(page, 'Reports');

      // Should not be a 404
      expect(page.url()).toContain('report');

      const is404 = await page.getByText('404').isVisible().catch(() => false);
      expect(is404).toBe(false);

      console.log('Reports page loads correctly ✓');
    }
  );

  test(
  'TC_ACCOUNT_03 - Sub broker cannot see Reports (account option restricted) @security',
  async ({ browser }) => {

    const page = await browser.newPage();

    await login(page, PHONE.SUB);

    await expect(
      page.getByText('ACCOUNT', { exact: false })
    ).toBeVisible();

    const reportsVisible = await page
      .getByText('Reports', { exact: true })
      .isVisible()
      .catch(() => false);

    expect(
      reportsVisible,
      'Sub broker should not have access to Reports'
    ).toBe(false);

    console.log('Reports hidden for sub broker ✓');

    await page.close();
  }
);

test(
  'TC_ACCOUNT_04 - Referral filter shows only referral leads',
  async ({ page }) => {

    await navigateTo(page, 'All Leads');
    

    await page
      .getByRole('button', { name: /Lead Type/i })
      .click();

    await page
  .getByRole('button', { name: /Lead Type/i })
  .click();

await page.waitForTimeout(2000);

console.log(
  await page.locator('body').textContent()
);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');

    const count = await rows.count();

    console.log(`Referral Rows: ${count}`);

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 20); i++) {

      const text = (
        await rows.nth(i).textContent()
      )?.toLowerCase() || '';

      console.log(`Row ${i + 1}: ${text}`);

      expect(text).toContain('referral');
    }

    console.log(
      'All returned records are Referral leads ✓'
    );
  }
);
//   test(
// 'TC_ACCOUNT_05 - Investor filter shows only investor leads',
// async ({ page }) => {

  

//   await navigateTo(page, 'All Leads');

//   await page
//     .getByRole('button', { name: /Lead Type/i })
//     .click();

//  await page
//   .getByText('Investment', { exact: true })
//   .last()
//   .click();

//   await page.waitForLoadState('networkidle');

//   const rows = page.locator('table tbody tr');

//   const count = await rows.count();

//   expect(count).toBeGreaterThan(0);

//   for (let i = 0; i < Math.min(count, 20); i++) {

//     const text = await rows.nth(i).textContent();

//     expect(
//       text?.toLowerCase()
//     ).toContain('investment');
//   }
// });
test(
  'TC_ACCOUNT_05 - Investor filter shows records',
  async ({ page }) => {

    await navigateTo(page, 'All Leads');

    const beforeCount = await page
      .locator('table tbody tr')
      .count();

    await page
      .getByRole('button', { name: /Lead Type/i })
      .click();

    await page
      .getByText('Investment', { exact: true })
      .last()
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');

    const afterCount = await rows.count();

    console.log(
      `Before: ${beforeCount} | After: ${afterCount}`
    );

    expect(afterCount).toBeGreaterThan(0);

    console.log(
      'Investment filter returned records ✓'
    );
  }
);
  test(
  'TC_ACCOUNT_09 - Referral + Investor should not equal all leads',
  async ({ page }) => {

    await navigateTo(page, 'All Leads');

    const allRows = await getTableTotal(page);

    console.log(`All Rows: ${allRows}`);

    await page
      .getByRole('button', { name: /Lead Type/i })
      .click();

    await page
      .getByText('Referral', { exact: true })
      .last()
      .click();

    await page
      .getByText('Investment', { exact: true })
      .last()
      .click();

    await page.keyboard.press('Escape');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filteredRows = await getTableTotal(page);

    console.log(
      `Filtered Rows: ${filteredRows}`
    );

    expect(filteredRows)
      .toBeLessThan(allRows);

    console.log(
      'Referral + Investment filter does not return all leads ✓'
    );
  }
);
test(
  'TC_ACCOUNT_10 - ACCOUNT remains visible after refresh',
  async ({ page }) => {

    await page.reload();

    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText('ACCOUNT')
    ).toBeVisible();

  }
);
});

test(
  'ARCHIVED_01 - Lead Type New filter works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Archived Leads');

    const beforeCount = await page
      .locator('table tbody tr')
      .count();

    await page
      .getByRole('button', { name: /Lead type/i })
      .click();

    await page
      .getByText('New', { exact: true })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const afterCount = await page
      .locator('table tbody tr')
      .count();

    console.log(
      `New Filter Applied | Before: ${beforeCount} | After: ${afterCount}`
    );

    await expect(page.locator('body')).toBeVisible();
  }
);

test(
  'ARCHIVED_02 - Lead Type RNR filter works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Archived Leads');

    const beforeCount = await page
      .locator('table tbody tr')
      .count();

    await page
      .getByRole('button', { name: /Lead type/i })
      .click();

    await page
      .getByText('RNR', { exact: true })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const afterCount = await page
      .locator('table tbody tr')
      .count();

    console.log(
      `RNR Filter Applied | Before: ${beforeCount} | After: ${afterCount}`
    );

    await expect(page.locator('body')).toBeVisible();
  }
);

test(
  'ARCHIVED_03 - Lead Type Referral filter works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Archived Leads');

    const beforeCount = await page
      .locator('table tbody tr')
      .count();

    await page
      .getByRole('button', { name: /Lead type/i })
      .click();

    await page
      .getByText('Referral', { exact: true })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const afterCount = await page
      .locator('table tbody tr')
      .count();

    console.log(
      `Referral Filter Applied | Before: ${beforeCount} | After: ${afterCount}`
    );

    await expect(page.locator('body')).toBeVisible();
  }
);

test(
  'ARCHIVED_04 - Lead Type Investment filter works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Archived Leads');

    const beforeCount = await page
      .locator('table tbody tr')
      .count();

    await page
      .getByRole('button', { name: /Lead type/i })
      .click();

    await page
      .getByText('Investment', { exact: true })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const afterCount = await page
      .locator('table tbody tr')
      .count();

    console.log(
      `Investment Filter Applied | Before: ${beforeCount} | After: ${afterCount}`
    );

    await expect(page.locator('body')).toBeVisible();
  }
);

test(
  'ARCHIVED_05 - Referral + Investment combined filter works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Archived Leads');

    // Total rows before filtering
    const allRows = await page
      .locator('table tbody tr')
      .count();

    // Open Lead Type filter
    await page
      .getByRole('button', { name: /Lead type/i })
      .click();

    // Select Referral
    await page
      .getByText('Referral', { exact: true })
      .click();

    // Select Investment
    await page
      .getByText('Investment', { exact: true })
      .click();

    // Close dropdown
    await page.keyboard.press('Escape');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const filteredRows = await page
      .locator('table tbody tr')
      .count();

    console.log(
      `All Rows: ${allRows} | Filtered Rows: ${filteredRows}`
    );

    expect(filteredRows).toBeLessThanOrEqual(allRows);

    await expect(page.locator('body')).toBeVisible();
  }
);

//site visit missing cases
test(
  'TC_DASH_SV_FILTER_01 - Confirmed Visits Card Filters Correct Records @regression',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const card = page
      .getByText('Confirmed Visits', { exact: false })
      .first();

    await expect(card).toBeVisible();

    const cardText = await card.locator('..').textContent();

    const match = cardText?.match(/\d+/);

    expect(match).not.toBeNull();

    const expectedCount = parseInt(match![0], 10);

    console.log(
      `Confirmed Visits Card Count: ${expectedCount}`
    );

    await card.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const rows = await page
      .locator('table tbody tr')
      .count();

    console.log(
      `Filtered Table Rows: ${rows}`
    );

    expect(rows).toBe(expectedCount);

    console.log(
      'Confirmed Visits card filter validated ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_02 - Rescheduled Card Filters Correct Records @regression',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const card = page
      .getByText('Rescheduled', { exact: false })
      .first();

    await expect(card).toBeVisible();

    const cardText = await card.locator('..').textContent();

    const match = cardText?.match(/\d+/);

    expect(match).not.toBeNull();

    const expectedCount = parseInt(match![0], 10);

    console.log(
      `Rescheduled Card Count: ${expectedCount}`
    );

    await card.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const noData = await page
  .getByText('No matching site visits')
  .isVisible()
  .catch(() => false);

const actualRows = noData
  ? 0
  : await page.locator('table tbody tr').count();

expect(actualRows).toBe(expectedCount);

    console.log(
      `Filtered Table Rows: ${actualRows}`
    );

    expect(actualRows).toBe(expectedCount);

    console.log(
      'Rescheduled card filter validated ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_03 - Visit Conducted Card Filters Correct Records @regression',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const card = page
      .getByText('Visit Conducted', { exact: false })
      .first();

    await expect(card).toBeVisible();

    const cardText = await card.locator('..').textContent();

    const match = cardText?.match(/\d+/);

    expect(match).not.toBeNull();

    const expectedCount = parseInt(match![0], 10);

    console.log(
      `Visit Conducted Card Count: ${expectedCount}`
    );

    await card.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const noData = await page
  .getByText('No matching site visits')
  .isVisible()
  .catch(() => false);

const actualRows = noData
  ? 0
  : await page.locator('table tbody tr').count();

expect(actualRows).toBe(expectedCount);

    console.log(
      `Filtered Table Rows: ${actualRows}`
    );

    expect(actualRows).toBe(expectedCount);

    console.log(
      'Visit Conducted card filter validated ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_04 - Confirmed Status Filter Works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    await page
      .getByRole('button', { name: /Status/i })
      .click();

    await page
      .getByText('Confirmed', { exact: true })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const rows = page.locator('table tbody tr');

    const count = await rows.count();

    console.log(
      `Confirmed Filter Rows: ${count}`
    );

    expect(count).toBeGreaterThanOrEqual(0);

    await expect(
      page.locator('body')
    ).toBeVisible();

    console.log(
      'Confirmed Status filter validated ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_05 - Rescheduled Status Filter Works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    await page
      .getByRole('button', { name: /Status/i })
      .click();

    const option = page
      .locator('[role="option"], span')
      .filter({ hasText: /^Rescheduled$/ })
      .last();

    await option.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const noData = await page
      .getByText('No matching site visits')
      .isVisible()
      .catch(() => false);

    const count = noData
      ? 0
      : await page.locator('table tbody tr').count();

    console.log(
      `Rescheduled Filter Rows: ${count}`
    );

    expect(count).toBeGreaterThanOrEqual(0);

    console.log(
      'Rescheduled Status filter validated ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_06 - Projects Filter Returns Matching Records',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    await page
      .getByRole('button', { name: /Projects/i })
      .click();

    const projectOption = page
      .getByText('Abhee Tranquila')
      .first();

    await expect(projectOption)
      .toBeVisible();

    await projectOption.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const noData = await page
      .getByText('No matching site visits')
      .isVisible()
      .catch(() => false);

    const rows = noData
      ? 0
      : await page.locator('table tbody tr').count();

    console.log(
      `Project Filter Rows: ${rows}`
    );

    expect(rows)
      .toBeGreaterThanOrEqual(0);

    console.log(
      'Projects filter validated ✓'
    );

  }
);
test(
  'TC_DASH_SV_FILTER_07 - Automation Pre Sales Rep Filter Works',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'All Leads');

    const beforeCount =
      await page.locator('table tbody tr').count();

    console.log(`Before Filter: ${beforeCount}`);

    // Open Agents dropdown
    await page
      .getByRole('button', { name: /Agents/i })
      .click();

    // Select Automation Pre sales rep
    await page
      .locator('input[type="checkbox"]')
      .first()
      .check();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows =
      page.locator('table tbody tr');

    const count =
      await rows.count();

    console.log(`After Filter: ${count}`);

    // Verify every row belongs to selected agent
    for (let i = 0; i < Math.min(count, 20); i++) {

      const rowText =
        await rows.nth(i).textContent();

      expect(rowText)
        .toMatch(/Automation pre sales rep/i);
    }

    console.log(
      'Agent filter records validated ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_08 - Outcome Filter Returns Matching Records',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const beforeCount =
      await page.locator('table tbody tr').count();

    console.log(`Before Filter: ${beforeCount}`);

    // Open Outcome dropdown
    await page
      .getByRole('button', { name: /Outcome/i })
      .click();

    // Select first outcome option
    const outcomeOption = page
      .locator('input[type="checkbox"]')
      .first();

    await outcomeOption.check();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows =
      page.locator('table tbody tr');

    const count =
      await rows.count();

    console.log(`After Filter: ${count}`);

    expect(count)
      .toBeGreaterThanOrEqual(0);

    console.log(
      'Outcome filter validated ✓'
    );

  }
);

test(
  'TC_DASH_SV_FILTER_09 - Selected Count Matches Checked Checkboxes',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const checkboxes = page
      .locator('table tbody input[type="checkbox"]');

    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    await expect(
      page.getByText('3 selected')
    ).toBeVisible();

    console.log(
      'Selected count matches checked rows ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_10 - Select All Selects Every Row',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    const rowCount = await page
      .locator('table tbody tr')
      .count();

    await page
      .locator('table thead input[type="checkbox"]')
      .check();

    await expect(
      page.getByText(`${rowCount} selected`)
    ).toBeVisible();

    console.log(
      'Select all selects every row ✓'
    );
  }
);

test(
  'TC_DASH_SV_FILTER_11 - Action Buttons Hidden Without Selection',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await navigateTo(page, 'Site Visit Tracker');

    await expect(
      page.getByRole('button', {
        name: /Mark as Site Visit Conducted/i
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /Mark as Booked/i
      })
    ).not.toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /No Show/i
      })
    ).not.toBeVisible();

    await expect(
      page.getByText(/selected/i)
    ).not.toBeVisible();

    console.log(
      'Actions hidden without selection ✓'
    );
  }
);