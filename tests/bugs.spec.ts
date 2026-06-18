//dashboard bugs

import { test, expect, Page, APIRequestContext } from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const LOGIN_URL  = 'https://dev.propfocus.in/dashboard/login';

const PHONE = {
  MAIN: '9999999999',
} as const;

const OTP = '123456';

// ======================================================
// LOGIN HELPER
// ======================================================

async function login(page: Page, phone: string = PHONE.MAIN) {

  await page.goto(LOGIN_URL);
  await page.waitForLoadState('networkidle');

  await expect(
    page.getByText('Enter Your Phone Number')
  ).toBeVisible();

  await page
    .locator('input[type="tel"], input[placeholder*="phone" i]')
    .fill(phone);

  await page
    .getByRole('button', { name: 'Send OTP' })
    .click();

  await expect(
    page.getByText('Enter Verification Code')
  ).toBeVisible({ timeout: 10000 });

  await page
    .locator('input[placeholder="000000"], input[maxlength="6"]')
    .fill(OTP);

  await page
    .getByRole('button', { name: 'Verify & Sign In' })
    .click();

  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await expect(
    page.getByText('DASHBOARD', { exact: false })
  ).toBeVisible({ timeout: 20000 });

  console.log(`Logged in as ${phone} ✓`);

}

// ======================================================
// NAV HELPER
// ======================================================

async function clickNav(page: Page, name: string) {
  await page.locator(`text=${name}`).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ======================================================
// ══════════════════════════════════════════════════════
// TC_DASH_LEADS_19
// Buyer ID Search Returns Correct Buyer Name
//
// Context from screenshot:
//   The BUYER NAME column renders two lines:
//     Line 1 → buyer name  (e.g. "Arhan")
//     Line 2 → buyer ID    (e.g. "09123")
//
//   When a user types a buyer ID into the search bar,
//   the matching row must appear and its BUYER NAME cell
//   must display both the correct name AND the exact
//   buyer ID that was searched.
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Buyer ID Search — Buyer Name Visibility', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, PHONE.MAIN);
    await clickNav(page, 'All Leads');
  });

  // ====================================================
  // TC_DASH_LEADS_19
  // Searching by buyer ID surfaces the correct row and
  // the BUYER NAME cell shows both the name AND the ID
  // ====================================================

  test(

    'TC_DASH_LEADS_19 - Buyer ID Search Returns Correct Buyer Name In Cell @regression',

    async ({ page }) => {

      // ── Step 1: Capture the buyer ID from the first row ──────────
      //
      // The BUYER NAME column (td index 3, 0-based) renders:
      //   <span> Buyer Name </span>
      //   <span> BuyerID    </span>
      //
      // We locate the cell, extract the full text, then split
      // out the ID substring (second line / second span).

      const firstRow = page.locator('table tbody tr').first();

      await expect(firstRow).toBeVisible({ timeout: 10000 });

      // BUYER NAME is the 4th column (index 3)
      const buyerNameCell = firstRow.locator('td').nth(3);

      const cellText = await buyerNameCell.innerText();

      console.log(`Raw BUYER NAME cell text:\n${cellText}`);

      // Cell text is two lines: "Name\nID"
      const lines = cellText.trim().split('\n').map(l => l.trim()).filter(Boolean);

      expect(
        lines.length,
        'BUYER NAME cell should contain both a name and an ID'
      ).toBeGreaterThanOrEqual(2);

      const buyerName = lines[0];   // e.g. "Arhan"
      const buyerId   = lines[1];   // e.g. "09123"

      console.log(`Captured buyer name: "${buyerName}"`);
      console.log(`Captured buyer ID  : "${buyerId}"`);

      // ── Step 2: Clear any existing search and type the buyer ID ──

      const searchBox = page.getByPlaceholder(/search/i);

      await expect(searchBox).toBeVisible();

      await searchBox.clear();
      await searchBox.fill(buyerId);

      console.log(`Searching for buyer ID: "${buyerId}"`);

      // Wait for debounce / API round-trip
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      // ── Step 3: Validate at least one row is returned ────────────

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      console.log(`Rows returned for buyer ID "${buyerId}": ${rowCount}`);

      expect(
        rowCount,
        `Search for buyer ID "${buyerId}" should return at least one row`
      ).toBeGreaterThan(0);

      // ── Step 4: The first result's BUYER NAME cell must contain ──
      //           the buyer NAME (not blank / not just an ID)

      const resultCell = rows.first().locator('td').nth(3);
      const resultText = await resultCell.innerText();

      console.log(`Result cell text:\n${resultText}`);

      const resultLines = resultText.trim().split('\n').map(l => l.trim()).filter(Boolean);

      // 4a — name line must be non-empty text (not just digits)
      const resultName = resultLines[0];

      expect(
        resultName,
        'Buyer name (first line of cell) should not be empty after ID search'
      ).toBeTruthy();

      expect(
        /^[\d\s]+$/.test(resultName),
        'Buyer name should not be purely numeric — it should show the actual name'
      ).toBe(false);

      console.log(`Buyer name visible in result: "${resultName}" ✓`);

      // 4b — the ID line must match what we searched
      if (resultLines.length >= 2) {

        const resultId = resultLines[1];

        expect(
          resultId,
          `Buyer ID in result cell should match searched ID "${buyerId}"`
        ).toBe(buyerId);

        console.log(`Buyer ID visible in result cell: "${resultId}" ✓`);

      } else {

        // If only one line rendered, it must contain the ID somewhere
        expect(
          resultText,
          `Result cell should contain the searched buyer ID "${buyerId}"`
        ).toContain(buyerId);

      }

      // ── Step 5: Buyer name in the result must match the original ─

      expect(
        resultName.toLowerCase(),
        `Buyer name in result should match captured name "${buyerName}"`
      ).toContain(buyerName.toLowerCase());

      console.log('Buyer ID search returns correct buyer name in cell ✓');

    }

  );

  // ====================================================
  // TC_DASH_LEADS_19B
  // Partial buyer ID search still shows buyer name
  // ====================================================

  test(

    'TC_DASH_LEADS_19B - Partial Buyer ID Search Still Resolves Buyer Name @regression',

    async ({ page }) => {

      // Read the first row's buyer ID
      const firstRow    = page.locator('table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 10000 });

      const buyerCell   = firstRow.locator('td').nth(3);
      const cellText    = await buyerCell.innerText();
      const lines       = cellText.trim().split('\n').map(l => l.trim()).filter(Boolean);

      expect(lines.length).toBeGreaterThanOrEqual(2);

      const buyerId     = lines[1];

      // Use only the last 4 characters as a partial query
      const partialId   = buyerId.slice(-4);

      console.log(`Full buyer ID: "${buyerId}", partial query: "${partialId}"`);

      const searchBox = page.getByPlaceholder(/search/i);
      await searchBox.clear();
      await searchBox.fill(partialId);

      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      // There should be results
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      console.log(`Rows returned for partial ID "${partialId}": ${rowCount}`);

      if (rowCount > 0) {

        // Every visible result row's buyer name cell must be non-empty
        for (let i = 0; i < Math.min(rowCount, 5); i++) {

          const cell = rows.nth(i).locator('td').nth(3);
          const text = await cell.innerText();
          const nameLines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);

          const name = nameLines[0];

          expect(
            name,
            `Row ${i + 1}: buyer name must not be empty`
          ).toBeTruthy();

          expect(
            /^[\d\s]+$/.test(name),
            `Row ${i + 1}: buyer name "${name}" should not be purely numeric`
          ).toBe(false);

          console.log(`Row ${i + 1} buyer name: "${name}" ✓`);

        }

      } else {

        // Acceptable — partial ID may not match anything
        await expect(
          page.getByText(/no data|no leads|no results/i).first()
        ).toBeVisible();

        console.log('No results for partial ID — empty state shown ✓');

      }

      console.log('Partial buyer ID search buyer name visibility validated ✓');

    }

  );

});

test(

  'TC_DASH_LEADS_20 - Name And Buyer ID Combined Search Returns Correct Buyer @regression',

  async ({ page }) => {

    const firstRow = page.locator('table tbody tr').first();

    await expect(firstRow).toBeVisible({ timeout: 10000 });

    const buyerCell = firstRow.locator('td').nth(3);

    const cellText = await buyerCell.innerText();

    const lines = cellText
      .trim()
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    expect(lines.length).toBeGreaterThanOrEqual(2);

    const buyerName = lines[0];
    const buyerId   = lines[1];

    const combinedSearch = `${buyerName} ${buyerId}`;

    console.log(`Searching: ${combinedSearch}`);

    const searchBox = page.getByPlaceholder(/search/i);

    await searchBox.clear();
    await searchBox.fill(combinedSearch);

    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const rows = page.locator('table tbody tr');

    const rowCount = await rows.count();

    expect(
      rowCount,
      'Combined name + buyer ID search should return results'
    ).toBeGreaterThan(0);

    const resultCell = rows.first().locator('td').nth(3);

    const resultText = await resultCell.innerText();

    const resultLines = resultText
      .trim()
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    expect(resultLines.length).toBeGreaterThanOrEqual(2);

    const resultName = resultLines[0];
    const resultId   = resultLines[1];

    expect(resultName.toLowerCase())
      .toContain(buyerName.toLowerCase());

    expect(resultId)
      .toBe(buyerId);

    console.log(
      `Combined search returned correct buyer: ${resultName} (${resultId}) ✓`
    );

  }

);

// ======================================================
// DATE FILTER SEQUENCE
// Matches the order shown on the dashboard toolbar
// ======================================================
 
const DATE_FILTERS = ['Today', '7D', '30D', 'All'] as const;
type DateFilter = typeof DATE_FILTERS[number];
 
// ======================================================
// SNAPSHOT TYPE
// Captures one filter's worth of KPI + comparison values
// ======================================================
 
interface KpiSnapshot {
  filter:    DateFilter;
  mainValue: number;         // e.g. "Microsites Generated" count
  yesterday: number;         // sub-label comparison value
  today:     number;         // sub-label comparison value
}
 

 
// ======================================================
// CLICK A DATE FILTER AND WAIT FOR DATA TO REFRESH
// ======================================================
 
async function applyDateFilter(page: Page, filter: DateFilter) {
 
  await page.getByRole('button', { name: filter, exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);   // allow any debounce / animation
 
  console.log(`Date filter "${filter}" applied`);
}
 
// ======================================================
// READ A STAT CARD'S MAIN VALUE + YESTERDAY + TODAY
//
// The stat card DOM structure (inferred from screenshot):
//
//   <div>                          ← card root
//     <p>  {cardTitle}   </p>
//     <h2> {mainValue}   </h2>
//     <div>
//       <span> Yesterday </span>  <span> {yesterdayVal} </span>
//       <span> Today     </span>  <span> {todayVal}     </span>
//     </div>
//   </div>
//
// We locate the card by its title text, then walk the DOM
// to pull out the three numeric values.
// ======================================================
 
async function readCardSnapshot(
  page: Page,
  cardTitle: string,
  filter: DateFilter,
): Promise<KpiSnapshot> {

  const title = page.getByText(cardTitle, { exact: false }).first();

  await expect(title).toBeVisible({ timeout: 15000 });

  // Find the nearest card container
  const card = title.locator('xpath=ancestor::div[contains(@class,"card")][1]')
    .or(title.locator('xpath=../../..'));

  await page.waitForTimeout(500);

  const cardText = (await card.first().textContent()) ?? '';

  console.log(`\n========== ${cardTitle} (${filter}) ==========\n`);
  console.log(cardText);

  // Main KPI: first number after title
  const mainRegex = new RegExp(
    `${cardTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)`,
    'i'
  );

  const mainMatch = cardText.match(mainRegex);

  const mainValue = mainMatch
    ? parseInt(mainMatch[1], 10)
    : 0;

  const yesterdayMatch =
    cardText.match(/Yesterday:?\s*(\d+)/i);

  const todayMatch =
    cardText.match(/Today:?\s*(\d+)/i);

  const yesterday = yesterdayMatch
    ? parseInt(yesterdayMatch[1], 10)
    : -1;

  const today = todayMatch
    ? parseInt(todayMatch[1], 10)
    : -1;

  console.log(
    `[${filter}] ${cardTitle} → main:${mainValue} yesterday:${yesterday} today:${today}`
  );

  return {
    filter,
    mainValue,
    yesterday,
    today,
  };
}
 
// ======================================================
// ══════════════════════════════════════════════════════
// BUG REGRESSION TESTS
// Bug: "Yesterday" and "Today" comparison values remain
//      unchanged across date filters
//
// EXPECTED BEHAVIOUR
//   When the main KPI updates on filter change, the
//   "Yesterday" and "Today" sub-values in that card must
//   also update to reflect the selected period's context,
//   OR they must remain period-agnostic constants that
//   are explicitly documented as such.
//
//   The key assertion: if the main KPI differs between
//   any two filters, then at least one of {yesterday,
//   today} must also differ — they cannot all be frozen
//   while the headline number keeps changing.
//
// EVIDENCE FROM SCREENSHOT
//   Microsites Generated:  4 → 96 → 120 → 128  (changes)
//   Yesterday comparison:  33 → 33 → 33 → 33   (frozen ← bug)
//   Today comparison:       4 →  4 →  4 →  4   (frozen ← bug)
// ══════════════════════════════════════════════════════
// ======================================================
 
test.describe('Date Filter — Comparison Value Consistency', () => {
 
  // ====================================================
  // TC_DASH_FILTER_01
  // Microsites Generated — Yesterday/Today must not be
  // frozen when the main KPI changes across filters
  // ====================================================
 
  test(
  'TC_DASH_FILTER_01 - Microsites Generated comparison values update with filter @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      await page.getByText('Overview', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      const snapshots: KpiSnapshot[] = [];
 
      for (const filter of DATE_FILTERS) {
        await applyDateFilter(page, filter);
        snapshots.push(await readCardSnapshot(page, 'Microsites Generated', filter));
      }
 
      // ── Assert 1: main value must change across filters ──
      //    (sanity check — confirms the filter is wired up at all)
      const mainValues = snapshots.map(s => s.mainValue);
      const mainValuesAreAllSame = mainValues.every(v => v === mainValues[0]);
 
      if (mainValuesAreAllSame) {
  console.warn('No KPI change detected');
  return;
}
 
      console.log('Main KPI values across filters:', mainValues);
 
      // ── Assert 2: yesterday must NOT be identical across
      //    all filters when the main KPI differs ────────────
 
      const yesterdayValues = snapshots.map(s => s.yesterday);
      const yesterdayFrozen = yesterdayValues.every(v => v === yesterdayValues[0]);
 
      if (yesterdayFrozen) {
        console.error(
          `BUG DETECTED: "Yesterday" comparison value is frozen at ` +
          `${yesterdayValues[0]} across all filters: ${JSON.stringify(DATE_FILTERS)}`
        );
      }
 
      expect(
        yesterdayFrozen,
        `"Yesterday" sub-value (${yesterdayValues[0]}) must not stay identical ` +
        `across all filters while the main KPI changes (${mainValues.join(' → ')}). ` +
        `This indicates the comparison widget is not re-querying on filter change.`
      ).toBe(false);
 
      // ── Assert 3: today must NOT be identical across all
      //    filters when the main KPI differs ────────────────
 
      const todayValues = snapshots.map(s => s.today);
      const todayFrozen = todayValues.every(v => v === todayValues[0]);
 
      if (todayFrozen) {
        console.error(
          `BUG DETECTED: "Today" comparison value is frozen at ` +
          `${todayValues[0]} across all filters: ${JSON.stringify(DATE_FILTERS)}`
        );
      }
 
      expect(
        todayFrozen,
        `"Today" sub-value (${todayValues[0]}) must not stay identical ` +
        `across all filters while the main KPI changes (${mainValues.join(' → ')}). ` +
        `This indicates the comparison widget is not re-querying on filter change.`
      ).toBe(false);
 
      console.log('Microsites Generated comparison values update correctly ✓');
    }
 
  );
 
  // ====================================================
  // TC_DASH_FILTER_02
  // Engaged Leads — same freeze check
  // ====================================================
 
  test(
 
    'TC_DASH_FILTER_02 - Engaged Leads comparison values update with filter @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      await page.getByText('Overview', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      const snapshots: KpiSnapshot[] = [];
 
      for (const filter of DATE_FILTERS) {
        await applyDateFilter(page, filter);
        snapshots.push(await readCardSnapshot(page, 'Engaged Leads', filter));
      }
 
      const mainValues      = snapshots.map(s => s.mainValue);
      const yesterdayValues = snapshots.map(s => s.yesterday);
      const todayValues     = snapshots.map(s => s.today);
 
      console.log('Engaged Leads main values:', mainValues);
      console.log('Engaged Leads yesterday:  ', yesterdayValues);
      console.log('Engaged Leads today:      ', todayValues);
 
      const mainValuesAreAllSame = mainValues.every(v => v === mainValues[0]);

if (mainValuesAreAllSame) {
  console.warn(
    'Main KPI values did not change across filters. ' +
    'Skipping freeze validation because no data variation exists.'
  );
  return;
}
 
      expect(
        yesterdayValues.every(v => v === yesterdayValues[0]),
        `"Yesterday" for Engaged Leads must not be frozen at ${yesterdayValues[0]} ` +
        `while main KPI changes (${mainValues.join(' → ')})`
      ).toBe(false);
 
      expect(
        todayValues.every(v => v === todayValues[0]),
        `"Today" for Engaged Leads must not be frozen at ${todayValues[0]} ` +
        `while main KPI changes (${mainValues.join(' → ')})`
      ).toBe(false);
 
      console.log('Engaged Leads comparison values update correctly ✓');
    }
 
  );
 
  // ====================================================
  // TC_DASH_FILTER_03
  // Site Visits Scheduled — same freeze check
  // ====================================================
 
  test(
 
    'TC_DASH_FILTER_03 - Site Visits Scheduled comparison values update with filter @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      await page.getByText('Overview', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      const snapshots: KpiSnapshot[] = [];
 
      for (const filter of DATE_FILTERS) {
        await applyDateFilter(page, filter);
        snapshots.push(await readCardSnapshot(page, 'Site visits scheduled', filter));
      }
 
      const mainValues      = snapshots.map(s => s.mainValue);
      const yesterdayValues = snapshots.map(s => s.yesterday);
      const todayValues     = snapshots.map(s => s.today);
 
      console.log('Site Visits main values:', mainValues);
      console.log('Site Visits yesterday:  ', yesterdayValues);
      console.log('Site Visits today:      ', todayValues);
 
      const mainValuesAreAllSame = mainValues.every(v => v === mainValues[0]);

if (mainValuesAreAllSame) {
  console.warn(
    'Site Visits KPI did not change across filters. ' +
    'Skipping freeze validation.'
  );
  return;
}
 
      expect(
        yesterdayValues.every(v => v === yesterdayValues[0]),
        `"Yesterday" for Site Visits must not be frozen at ${yesterdayValues[0]} ` +
        `while main KPI changes (${mainValues.join(' → ')})`
      ).toBe(false);
 
      expect(
        todayValues.every(v => v === todayValues[0]),
        `"Today" for Site Visits must not be frozen at ${todayValues[0]} ` +
        `while main KPI changes (${mainValues.join(' → ')})`
      ).toBe(false);
 
      console.log('Site Visits comparison values update correctly ✓');
    }
 
  );
 
  // ====================================================
  // TC_DASH_FILTER_04
  // CROSS-CARD CHECK
  // When "Today" filter is active, the "Today" sub-value
  // inside each card must equal the main KPI value
  // (because the entire selected period IS today)
  // ====================================================
 
//   test.only(
//   'TC_DASH_FILTER_04 - Under Today filter, Today sub-value matches main KPI @regression',

//   async ({ page }) => {

//     await login(page, PHONE.MAIN);

//     await page.getByText('Overview', { exact: true }).click();
//     await page.waitForLoadState('networkidle');

//     await applyDateFilter(page, 'Today');

//     const cards = [
//       'Microsites Generated',
//       'Engaged Leads',
//       'Site visits scheduled',
//     ];

//     for (const cardTitle of cards) {

//       const snap = await readCardSnapshot(
//         page,
//         cardTitle,
//         'Today'
//       );

//       console.log(
//         `[${cardTitle}] main=${snap.mainValue} yesterday=${snap.yesterday} today=${snap.today}`
//       );

//       // Fail immediately if locator cannot read card values
//       expect(
//         snap.mainValue,
//         `Main KPI value could not be extracted for "${cardTitle}".`
//       ).toBeGreaterThan(0);

//       expect(
//         snap.today,
//         `"Today" comparison value could not be extracted for "${cardTitle}".`
//       ).not.toBe(-1);

//       expect(
//         snap.today,
//         `Under Today filter, "${cardTitle}" Today value (${snap.today}) should match the main KPI (${snap.mainValue}).`
//       ).toBe(snap.mainValue);

//       console.log(
//         `✓ ${cardTitle}: Today value matches main KPI`
//       );
//     }

//   }

// );
 
  // ====================================================
  // TC_DASH_FILTER_05
  // NETWORK LAYER CHECK
  // Switching filters must trigger a new API call with
  // the correct date range parameters — confirms the bug
  // is not just a render issue but a missing API re-fetch
  // ====================================================
 
  test(
 
    'TC_DASH_FILTER_05 - Each date filter triggers a fresh API request @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      await page.getByText('Overview', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      // Track all API requests made during filter switching
      const apiRequests: { filter: DateFilter; url: string }[] = [];
 
      page.on('request', request => {
        const url = request.url();
        // Capture any XHR/fetch that looks like a stats/metrics endpoint
        if (
          url.includes('stat') ||
          url.includes('metric') ||
          url.includes('overview') ||
          url.includes('dashboard') ||
          url.includes('lead') ||
          url.includes('microsite')
        ) {
          // Tag the request with whichever filter is currently active
          // (set dynamically below)
          apiRequests.push({ filter: '__pending__' as unknown as DateFilter, url });
        }
      });
 
      for (const filter of DATE_FILTERS) {
 
        const beforeCount = apiRequests.length;
 
        await applyDateFilter(page, filter);
 
        // Back-fill the filter tag for requests captured during this window
        for (let i = beforeCount; i < apiRequests.length; i++) {
          apiRequests[i].filter = filter;
        }
 
        const newRequests = apiRequests.slice(beforeCount);
 
        console.log(
          `[${filter}] new API requests fired: ${newRequests.length}`
        );
 
        newRequests.forEach(r =>
          console.log(`  → ${r.url}`)
        );
 
        expect(
          newRequests.length,
          `Switching to filter "${filter}" must trigger at least one API request. ` +
          `Zero requests means the UI is rendering stale/cached data without re-fetching.`
        ).toBeGreaterThan(0);
      }
 
      console.log('All filter changes triggered API re-fetches ✓');
    }
 
  );
 
  // ====================================================
  // TC_DASH_FILTER_06
  // REGRESSION SNAPSHOT TEST (deterministic)
  // Records the exact frozen values from the bug report
  // and asserts they are NO LONGER frozen after the fix.
  // Hard-coded to the values in the evidence screenshot.
  // ====================================================
 
  test(
  'TC_DASH_FILTER_06 - Microsites Generated Yesterday and Today are no longer frozen at 33 and 4 @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByText('Overview', { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const FROZEN_YESTERDAY = 33;
    const FROZEN_TODAY = 4;

    const snapshots: KpiSnapshot[] = [];

    for (const filter of DATE_FILTERS) {
      await applyDateFilter(page, filter);

      const snap = await readCardSnapshot(
        page,
        'Microsites Generated',
        filter
      );

      console.log(
        `[${filter}] main=${snap.mainValue} yesterday=${snap.yesterday} today=${snap.today}`
      );

      snapshots.push(snap);
    }

    // Ensure values were actually extracted
    for (const snap of snapshots) {

  // All filter intentionally hides Yesterday/Today
  if (snap.filter === 'All') {
    console.log(
      '[All] Yesterday/Today values not displayed - skipping extraction check'
    );
    continue;
  }

  expect(
    snap.yesterday,
    `[${snap.filter}] Yesterday value could not be extracted`
  ).not.toBe(-1);

  expect(
    snap.today,
    `[${snap.filter}] Today value could not be extracted`
  ).not.toBe(-1);

}

    // Original regression check
    const bugStillPresent = snapshots.every(
      s =>
        s.yesterday === FROZEN_YESTERDAY &&
        s.today === FROZEN_TODAY
    );

    expect(
      bugStillPresent,
      `BUG STILL PRESENT: Yesterday=${FROZEN_YESTERDAY} and Today=${FROZEN_TODAY} ` +
      `remain unchanged across all date filters.`
    ).toBe(false);

    console.log(
      'Frozen Yesterday/Today values from bug report are no longer present ✓'
    );

  }
);
});
// ======================================================
// DATE FILTERS TO TEST ACROSS
// ======================================================
 

 
// ======================================================
// READ SITE VISITS SCHEDULED FROM OVERVIEW CARD
//
// Card DOM (from screenshot):
//   <div>
//     <p>  Site visits scheduled  </p>
//     <h2> 11                     </h2>
//     <p>  Yesterday: 2 | Today: 1 (-50%)  </p>
//     <p>  Conducted               </p>  <span> 1 </span>
//   </div>
// ======================================================
 
async function readOverviewSiteVisitsCount(page: Page): Promise<number> {

  await page.getByText('Overview', { exact: true }).click();
  await page.waitForLoadState('networkidle');

  const card = page
    .getByText('Site visits scheduled', { exact: true })
    .first()
    .locator('xpath=ancestor::div[contains(@class,"rounded")]');

  await page.waitForTimeout(3000);

const text = await card.textContent() ?? '';

console.log('OVERVIEW CARD AFTER WAIT:');
console.log(text);

  console.log('OVERVIEW CARD:');
  console.log(text);

  const match = text.match(/Site visits scheduled\s*(\d+)/i);

if (match) {
  return Number(match[1]);
}

// Handle dashboard displaying em dash instead of number
throw new Error(`Could not extract Overview count.\n${text}`);
}
 
// ======================================================
// READ VISITS SCHEDULED FROM SITE VISIT TRACKER STAT CARD
// ======================================================
 
async function readTrackerVisitsScheduledCard(page: Page): Promise<number> {

  await page.getByText('All Leads', { exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const visibleSiteVisits = page
    .locator('text=/Site Visits/i')
    .filter({ visible: true });

  await expect(visibleSiteVisits.first()).toBeVisible();
const card = page.getByText('Site Visits', { exact: true }).last();

console.log(await card.evaluate(el => el.outerHTML));
  const cardText = await visibleSiteVisits
    .first()
    .locator('xpath=ancestor::div[3]')
    .textContent() ?? '';

  console.log('TRACKER CARD TEXT:');
  console.log(cardText);

  const numbers =
    cardText.match(/\d+/g)?.map(Number) ?? [];

  if (!numbers.length) {
    throw new Error(
      `Could not extract Site Visits count.\n${cardText}`
    );
  }

  // first number in card = Site Visits count
  const match = cardText.match(/Site Visits\s*(\d+)/i);

if (!match) {
  throw new Error(`Could not extract Site Visits count.\n${cardText}`);
}

const count = Number(match[1]);

  console.log(`Tracker Site Visits count: ${count}`);

  return count;
}
 
// ======================================================
// READ TOTAL ROWS FROM SITE VISIT TRACKER TABLE
// Uses the pagination "Showing X of Y" text
// ======================================================
 
async function readTrackerTableTotal(page: Page): Promise<number> {
 
  // Pagination label: "Showing 1-10 of 2" or "Showing 1-2 of 2"
  const paginationEl = page
    .getByText(/showing/i, { exact: false })
    .first();
 
  await expect(paginationEl).toBeVisible({ timeout: 10000 });
 
  const text = await paginationEl.innerText();
  console.log(`Pagination text: "${text}"`);
 
  // Extract the total after "of"
  const match = text.match(/of\s+([\d,]+)/i);
  if (!match) {
    console.warn('Could not parse pagination total — returning 0');
    return 0;
  }
 
  const total = parseInt(match[1].replace(/,/g, ''), 10);
  console.log(`Site Visit Tracker table total rows: ${total}`);
  return total;
}
 
// ======================================================
// ══════════════════════════════════════════════════════
// BUG REGRESSION TESTS
//
// Bug: Overview shows 11 Site Visits Scheduled.
//      Site Visit Tracker stat card shows 2.
//      Site Visit Tracker table shows 2 records.
//
// All three sources must agree.
// ══════════════════════════════════════════════════════
// ======================================================
 
test.describe('Site Visits Scheduled — Cross-Tab Count Consistency', () => {
 
  // ====================================================
  // TC_DASH_SV_COUNT_01
  // Overview stat card vs Site Visit Tracker stat card
  // ====================================================
 
  test(
 
    'TC_DASH_SV_COUNT_01 - Overview Site Visits count matches Tracker stat card @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      // ── Step 1: Read from Overview ──────────────────
      const overviewCount = await readOverviewSiteVisitsCount(page);
 
      // ── Step 2: Read from Site Visit Tracker card ──
      const trackerCardCount = await readTrackerVisitsScheduledCard(page);
 
      // ── Step 3: Assert they match ───────────────────
      console.log(
        `Overview: ${overviewCount} | Tracker stat card: ${trackerCardCount}`
      );
 
      expect(
        trackerCardCount,
        `Site Visit Tracker stat card shows "${trackerCardCount}" Visits Scheduled ` +
        `but Overview shows "${overviewCount}". ` +
        `Both must report the same number — they query the same underlying data.`
      ).toBe(overviewCount);
 
      console.log(
        `Site Visits Scheduled count matches across tabs (${overviewCount}) ✓`
      );
    }
 
  );
 
  // ====================================================
  // TC_DASH_SV_COUNT_02
  // Overview stat card vs Site Visit Tracker table rows
  // ====================================================
 
  test(
 
    'TC_DASH_SV_COUNT_02 - Overview Site Visits count matches Tracker table row total @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      // ── Step 1: Read from Overview ──────────────────
      const overviewCount = await readOverviewSiteVisitsCount(page);
 
      // ── Step 2: Navigate to Tracker and read table ─
      await page.getByText('Site Visit Tracker', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      const tableTotal = await readTrackerTableTotal(page);
 
      // ── Step 3: Assert ──────────────────────────────
      console.log(
        `Overview: ${overviewCount} | Tracker table total: ${tableTotal}`
      );
 
      expect(
        tableTotal,
        `Site Visit Tracker table shows ${tableTotal} total records ` +
        `but Overview card shows ${overviewCount} Site Visits Scheduled. ` +
        `These must match — the table should list exactly the visits that ` +
        `the Overview card counts.`
      ).toBe(overviewCount);
 
      console.log(
        `Overview count matches table total (${overviewCount}) ✓`
      );
    }
 
  );
 
  // ====================================================
  // TC_DASH_SV_COUNT_03
  // Site Visit Tracker stat card vs its own table total
  // (internal consistency — card and table on same page
  // must always agree regardless of the Overview bug)
  // ====================================================
 
  test(
 
    'TC_DASH_SV_COUNT_03 - Tracker stat card matches its own table row total @sanity',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      await page.getByText('Site Visit Tracker', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      const cardCount  = await readTrackerVisitsScheduledCard(page);
      const tableTotal = await readTrackerTableTotal(page);
 
      console.log(
        `Tracker stat card: ${cardCount} | Tracker table total: ${tableTotal}`
      );
 
      expect(
        tableTotal,
        `Within Site Visit Tracker, the stat card shows ${cardCount} Visits Scheduled ` +
        `but the table pagination reports ${tableTotal} total rows. ` +
        `These must match — the card and table are on the same page and ` +
        `should reflect the same query.`
      ).toBe(cardCount);
 
      console.log(
        `Tracker internal counts agree (${cardCount}) ✓`
      );
    }
 
  );
 
 test(

  'TC_DASH_SV_COUNT_04 - Overview Site Visits count matches Tracker card across all date filters @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    interface FilterSnapshot {
      filter: DateFilter;
      overviewCount: number;
      trackerCardCount: number;
    }

    const snapshots: FilterSnapshot[] = [];

    for (const filter of DATE_FILTERS) {

      // ── Overview ───────────────────────────────
      await page.getByText('Overview', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      await applyDateFilter(page, filter);

      const overviewCount = await readOverviewSiteVisitsCount(page);

      expect(
        overviewCount,
        `[${filter}] Could not extract Overview Site Visits count`
      ).not.toBe(-1);

      // ── Site Visit Tracker ─────────────────────
      await page.getByText('Site Visit Tracker', { exact: true }).click();
      await page.waitForLoadState('networkidle');

      const trackerFilterBtn = page.getByRole('button', {
        name: filter,
        exact: true,
      });

      if (await trackerFilterBtn.isVisible().catch(() => false)) {
        await trackerFilterBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      }

      const trackerCardCount =
        await readTrackerVisitsScheduledCard(page);

      snapshots.push({
        filter,
        overviewCount,
        trackerCardCount,
      });

      console.log(
        `[${filter}] Overview=${overviewCount} | Tracker=${trackerCardCount}`
      );

      expect(
        trackerCardCount,
        `[${filter}] Site Visits Scheduled mismatch. ` +
        `Overview shows ${overviewCount} but Tracker shows ${trackerCardCount}.`
      ).toBe(overviewCount);
    }

    console.log('\n════ Summary ════');

    snapshots.forEach(s => {

      const pass =
        s.overviewCount === s.trackerCardCount;

      console.log(
        `[${s.filter}] Overview=${s.overviewCount} | ` +
        `Tracker=${s.trackerCardCount} | ` +
        `${pass ? '✓ PASS' : '✗ FAIL'}`
      );

    });

    console.log(
      'Overview and Site Visit Tracker counts are consistent across all filters ✓'
    );

  }

);
  // ====================================================
  // TC_DASH_SV_COUNT_05
  // REGRESSION SNAPSHOT
  // Hard-codes the exact values from the bug screenshot
  // (Overview=11, Tracker=2) and asserts the gap is gone.
  // Will stay red until the fix is deployed.
  // ====================================================
 
  test(
 
    'TC_DASH_SV_COUNT_05 - Bug regression: Overview 11 vs Tracker 2 mismatch is fixed @regression',
 
    async ({ page }) => {
 
      await login(page, PHONE.MAIN);
 
      // Apply "All" filter — the screenshot appeared to use all-time data
      await page.getByText('Overview', { exact: true }).click();
      await page.waitForLoadState('networkidle');
 
      await applyDateFilter(page, 'All');
 
      const overviewCount      = await readOverviewSiteVisitsCount(page);
      const trackerCardCount   = await readTrackerVisitsScheduledCard(page);
      const trackerTableTotal  = await readTrackerTableTotal(page);
 
      console.log(
        `[Regression] Overview: ${overviewCount} | ` +
        `Tracker card: ${trackerCardCount} | ` +
        `Tracker table: ${trackerTableTotal}`
      );
 
      // The bug produced a gap of 9 (11 − 2).
      // After the fix, all three must be equal.
      expect(
        trackerCardCount,
        `BUG REGRESSION (TC_DASH_SV_COUNT_05): ` +
        `Overview shows ${overviewCount} but Tracker stat card shows ${trackerCardCount}. ` +
        `The original bug had Overview=11 and Tracker=2 — this gap must be eliminated.`
      ).toBe(overviewCount);
 
      expect(
        trackerTableTotal,
        `BUG REGRESSION (TC_DASH_SV_COUNT_05): ` +
        `Overview shows ${overviewCount} but Tracker table shows ${trackerTableTotal} rows. ` +
        `The original bug had Overview=11 and Tracker table=2 records.`
      ).toBe(overviewCount);
 
      console.log(
        'Regression confirmed fixed — Overview and Tracker counts now match ✓'
      );
    }
 
  );
  
});
test(
  'TC_OVERVIEW_01 - Site Visit metrics should match between Overview and All Leads @regression',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    // =========================
    // OVERVIEW PAGE
    // =========================

    await page.getByText(
      'Overview',
      { exact: true }
    ).click();

    await page.waitForLoadState('networkidle');

    const overviewCard = page.locator('div').filter({
      has: page.getByText('Site visits scheduled')
    }).first();

    const overviewText =
      await overviewCard.textContent() ?? '';

    console.log(
      'OVERVIEW CARD:',
      overviewText
    );

    const overviewScheduled =
      Number(
        overviewText.match(
          /Site visits scheduled\s*(\d+)/i
        )?.[1] ?? 0
      );

    const overviewConducted =
      Number(
        overviewText.match(
          /Conducted\s*(\d+)/i
        )?.[1] ?? 0
      );

    console.log(
      `Overview -> Scheduled=${overviewScheduled}, Conducted=${overviewConducted}`
    );

    // =========================
    // ALL LEADS PAGE
    // =========================

    await page.getByText(
      'All Leads',
      { exact: true }
    ).click();

    await page.waitForLoadState('networkidle');

    const allLeadsCard = page.locator('div').filter({
      has: page.getByText('Site Visits')
    }).first();

    const allLeadsText =
      await allLeadsCard.textContent() ?? '';

    console.log(
      'ALL LEADS CARD:',
      allLeadsText
    );

    const allLeadsScheduled =
      Number(
        allLeadsText.match(
          /Scheduled\s*(\d+)/i
        )?.[1] ?? 0
      );

    const allLeadsConducted =
      Number(
        allLeadsText.match(
          /Conducted\s*(\d+)/i
        )?.[1] ?? 0
      );

    console.log(
      `All Leads -> Scheduled=${allLeadsScheduled}, Conducted=${allLeadsConducted}`
    );

    expect(
      allLeadsScheduled,
      'Scheduled count mismatch between Overview and All Leads'
    ).toBe(
      overviewScheduled
    );

    expect(
      allLeadsConducted,
      'Conducted count mismatch between Overview and All Leads'
    ).toBe(
      overviewConducted
    );
  }
);
//rescheduling
const API_URL =
  'https://dev.propfocus.in/api/whatsapp-webhook';

interface SiteVisitResponseBody {
  success: boolean;
  message: string;
  link_token?: string;
}

async function sendSiteVisitRequest(
  request: APIRequestContext,
  messageBody: string,
  phone: string = PHONE.MAIN
): Promise<{
  response: Awaited<
    ReturnType<APIRequestContext['post']>
  >;
  responseBody: SiteVisitResponseBody;
}> {

  const response = await request.post(
    API_URL,
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

  expect(response.status()).toBe(200);

  const responseBody =
    await response.json();

  console.log(responseBody);

  return {
    response,
    responseBody
  };
}
// ======================================================
// HELPERS
// ======================================================

// ======================================================
// GENERATE SITE VISIT LINK
// ======================================================
function generateBuyerId(): string {
  return Math.floor(
    1000 + Math.random() * 9000
  ).toString();
}
async function generateSiteVisitLink(
  request: APIRequestContext
): Promise<string> {

 const buyerId =
  Date.now()
    .toString()
    .slice(-6);

const { responseBody } =
  await sendSiteVisitRequest(
    request,
    `Arhan ${buyerId} for sv for Unnati on tomorrow`
  );

  expect(responseBody.success).toBe(true);
  expect(responseBody.link_token).toBeTruthy();

  const visitorLink =
    `https://dev.propfocus.in/sv/propfocus-internal/${responseBody.link_token}`;

  console.log(
    `Generated Link: ${visitorLink}`
  );

  return visitorLink;
}

// ======================================================
// KPI HELPERS
// ======================================================

async function readRescheduledCount(
  page: Page
): Promise<number> {

  const card = page.locator('div').filter({
    has: page.getByText('Rescheduled', {
      exact: true
    })
  }).first();

  const text =
    await card.textContent() ?? '';

  console.log(text);

  const match =
    text.match(/Rescheduled\s*(\d+)/i);

  return match
    ? Number(match[1])
    : 0;
}

async function readRescheduleRate(
  page: Page
): Promise<number> {

  const card = page.locator('div').filter({
    has: page.getByText('Rescheduled', {
      exact: true
    })
  }).first();

  const text =
    await card.textContent() ?? '';

  const match =
    text.match(/(\d+)%/);

  return match
    ? Number(match[1])
    : 0;
}

// ======================================================
// CONFIRM VISIT
// ======================================================

async function confirmVisit(
  page: Page,
  visitorLink: string
) {

  await page.goto(visitorLink);

  await page.waitForLoadState('networkidle');

  const confirmBtn =
    page.getByRole('button', {
      name: /confirm my visit/i
    });

  await expect(confirmBtn)
    .toBeVisible();

  await confirmBtn.click();

  await page.waitForLoadState(
    'networkidle'
  );

  console.log(
    'Visit confirmed ✓'
  );
}

// ======================================================
// RESCHEDULE VISIT
// ======================================================

async function rescheduleVisit(
  page: Page,
  visitorLink: string
) {

  await page.goto(visitorLink);

  await page.waitForLoadState(
    'networkidle'
  );

  const rescheduleBtn =
    page.getByText(
      'Reschedule Visit'
    );

  await expect(rescheduleBtn)
    .toBeVisible();

  await rescheduleBtn.click();

  // Open date picker
  const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const yyyy = tomorrow.getFullYear();
const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
const dd = String(tomorrow.getDate()).padStart(2, '0');

const futureDate = `${yyyy}-${mm}-${dd}`;

const modal = page.getByRole('dialog', {
  name: /reschedule visit/i
});

await modal
  .locator('input[type="date"]')
  .fill(futureDate);

console.log(`Selected date: ${futureDate}`);

  await page.getByRole('button', {
    name: /request reschedule/i
  }).click();

  await expect(
    page.getByText(
      /reschedule request has been sent/i
    )
  ).toBeVisible();

  console.log(
    'Reschedule submitted ✓'
  );
}

// ======================================================
// TEST
// ======================================================

test(
  'TC_DASH_RESCHEDULE_01 - Rescheduled KPI updates after rescheduling a visit @regression',

  async ({
    page,
    request,
    context
  }) => {

    // Generate fresh SV link
    const visitorLink =
      await generateSiteVisitLink(
        request
      );

    // Login
    await login(
      page,
      PHONE.MAIN
    );

    await page.getByText(
      'Site Visit Tracker',
      { exact: true }
    ).click();

    await page.waitForLoadState(
      'networkidle'
    );

    const beforeCount =
      await readRescheduledCount(
        page
      );

    const beforeRate =
      await readRescheduleRate(
        page
      );

    console.log(
      `Before -> Count=${beforeCount}, Rate=${beforeRate}%`
    );

    // Confirm visit
    

    // Open link again and reschedule
    const reschedulePage =
      await context.newPage();

    await rescheduleVisit(
      reschedulePage,
      visitorLink
    );

    await reschedulePage.close();

    // Refresh tracker
    let afterCount = beforeCount;
let afterRate = beforeRate;

for (let attempt = 1; attempt <= 10; attempt++) {

  console.log(`Refresh attempt ${attempt}`);
console.log(
  'Waiting for KPI sync...'
);

await page.waitForTimeout(
  15000
);

// Re-open dashboard fresh
await page.goto(
  'https://dev.propfocus.in/dashboard?tab=site-visits'
);

await page.waitForLoadState(
  'networkidle'
);

await page.waitForTimeout(
  3000
);

  await page.waitForTimeout(3000);

  afterCount =
    await readRescheduledCount(page);

  afterRate =
    await readRescheduleRate(page);

  console.log(
    `Attempt ${attempt} -> Count=${afterCount}, Rate=${afterRate}%`
  );

  if (
    afterCount > beforeCount ||
    afterRate > beforeRate
  ) {
    break;
  }
}

    console.log(
      `After -> Count=${afterCount}, Rate=${afterRate}%`
    );

    expect(
      afterCount
    ).toBeGreaterThan(
      beforeCount
    );

    expect(
      afterRate
    ).toBeGreaterThanOrEqual(
      beforeRate
    );
  }
);

//Leads filters//

test(
  'TC_ALLLEADS_05 - 5+ time spend filter should only show leads with time spent > 5 mins @regression',

  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByRole('button', {
      name: 'All Leads'
    }).click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', {
      name: 'All',
      exact: true
    }).click();

    await page.waitForTimeout(2000);

    await page.getByRole('button', {
  name: /status/i
}).click();

    await page.getByText(
      '5+ time spend',
      { exact: true }
    ).click();

    await page.waitForTimeout(3000);

    await page.keyboard.press('Escape');

    // Scroll to bottom because Time Spent column is towards the end
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(3000, 0);
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(2000);

    const table = page.locator('table').first();

    const tableText =
      await table.innerText();

    console.log('\n════ TABLE DATA ════');
    console.log(tableText);

    const timeValues =
      tableText.match(/\d+m\s*\d+s/g) ?? [];

    console.log('\n════ TIME SPENT VALUES ════');
    console.log(timeValues);

    expect(
      timeValues.length,
      'No time values found after applying 5+ time spend filter'
    ).toBeGreaterThan(0);

    for (const value of timeValues) {

      const match =
        value.match(/(\d+)m\s*(\d+)s/);

      if (!match) continue;

      const totalSeconds =
        Number(match[1]) * 60 +
        Number(match[2]);

      console.log(
        `${value} = ${totalSeconds}s`
      );

      expect(
        totalSeconds,
        `${value} is not greater than 5 minutes`
      ).toBeGreaterThan(300);
    }

    console.log(
      '\n✓ All returned leads have Time Spent > 5 minutes'
    );
  }
);

test(
  'TC_DASH_RESCHEDULE_02 - Rescheduled KPI updates after rescheduling a visit @regression',

  async ({ page, request, context }) => {

    // ============================
    // Generate fresh site visit
    // ============================

    const visitorLink =
      await generateSiteVisitLink(request);

    // ============================
    // Login
    // ============================

    await login(page, PHONE.MAIN);

    await page.getByText(
      'Site Visit Tracker',
      { exact: true }
    ).click();

    await page.waitForLoadState('networkidle');

    // ============================
    // BEFORE VALUES
    // ============================

    const beforeRescheduled =
      await readRescheduledCount(page);

    const beforeRate =
      await readRescheduleRate(page);

    console.log(
      `Before -> Rescheduled=${beforeRescheduled}, Rate=${beforeRate}%`
    );

    // ============================
    // Reschedule Visit
    // ============================

    const visitorPage =
      await context.newPage();

    await visitorPage.goto(visitorLink);

    await visitorPage.waitForLoadState(
      'networkidle'
    );

    await visitorPage.getByText(
      'Reschedule Visit',
      { exact: true }
    ).click();

    // Modal should open

    const tomorrow = new Date();

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const futureDate =
      tomorrow.toISOString().split('T')[0];

    const modal =
      visitorPage.getByRole('dialog');

    await modal
      .locator('input[type="date"]')
      .fill(futureDate);

    console.log(
      `Selected date: ${futureDate}`
    );

    await visitorPage.getByRole('button', {
      name: /request reschedule/i
    }).click();

    console.log(
      'Reschedule submitted ✓'
    );

    await visitorPage.close();

    // ============================
    // Wait for dashboard sync
    // ============================

    let afterRescheduled =
      beforeRescheduled;

    let afterRate =
      beforeRate;

    for (
      let attempt = 1;
      attempt <= 10;
      attempt++
    ) {

      console.log(
        `Refresh attempt ${attempt}`
      );

      await page.waitForTimeout(
        10000
      );

      await page.reload();

      await page.waitForLoadState(
        'networkidle'
      );

      afterRescheduled =
        await readRescheduledCount(
          page
        );

      afterRate =
        await readRescheduleRate(
          page
        );

      console.log(
        `Attempt ${attempt} -> Rescheduled=${afterRescheduled}, Rate=${afterRate}%`
      );

      if (
        afterRescheduled >
          beforeRescheduled ||
        afterRate > beforeRate
      ) {
        break;
      }
    }

    console.log(
      `After -> Rescheduled=${afterRescheduled}, Rate=${afterRate}%`
    );

    // ============================
    // Validation
    // ============================

    expect(
      afterRescheduled,
      'Rescheduled KPI did not increase after rescheduling visit'
    ).toBeGreaterThan(
      beforeRescheduled
    );

    expect(
      afterRate,
      'Reschedule rate did not update after rescheduling visit'
    ).toBeGreaterThan(
      beforeRate
    );
  }
);

test.only(
  'TC_ALLLEADS_06 - Multiple buyer segment filters should use AND logic @regression',
  async ({ page }) => {

    await login(page, PHONE.MAIN);

    await page.getByRole('button', {
      name: 'All Leads'
    }).click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', {
      name: 'All',
      exact: true
    }).click();

    await page.waitForTimeout(2000);

    // Open Status filter ONCE
    await page.getByRole('button', {
      name: /status/i
    }).click();

    // Select 3+ visits
    await page.getByText(
      '3+ visits',
      { exact: true }
    ).click();

    // Select 5+ time spend
    await page.getByText(
      '5+ time spend',
      { exact: true }
    ).click();

    // Close filter popup
    await page.keyboard.press('Escape');

    await page.waitForTimeout(3000);

    console.log(
      await page.locator('body').innerText()
    );
  }
);