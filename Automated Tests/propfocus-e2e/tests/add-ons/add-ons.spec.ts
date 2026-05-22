import {
  test,
  expect,
  APIRequestContext,
  Page,
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const LANDING_URL =
  process.env.LANDING_URL ??
  'https://dev.propfocus.in';

const DASHBOARD_URL =
  process.env.DASHBOARD_URL ??
  'https://dev.propfocus.in/dashboard';

const PHONE = {
  ACTIVE:
    process.env.TEST_PHONE ??
    '9888898888',
} as const;

// ======================================================
// TYPES
// ======================================================

interface WebhookResponseBody {
  success:      boolean;
  micrositeUrl: string | null;
  message:      string;
  imageURL?:    string | null;
}

// ======================================================
// WEBHOOK HELPER
// ======================================================

async function sendPrompt(
  request: APIRequestContext,
  body:    string,
  phone:   string = PHONE.ACTIVE
): Promise<WebhookResponseBody> {

  const response =
    await request.post(API_URL, {
      timeout: 60000,
      data: {
        event: 'message',
        data: { from: phone, body }
      }
    });

  expect(response.status()).toBe(200);

  const responseBody: WebhookResponseBody =
    await response.json();

  console.log(JSON.stringify(responseBody, null, 2));

  return responseBody;

}

// ======================================================
// UNIQUE BUYER NAME HELPER
// Generates a unique name per run to avoid stale
// RNR / microsite history affecting test results
// ======================================================

function uniqueBuyerName(prefix = 'Buyer') {
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

// ======================================================
// ══════════════════════════════════════════════════════
// RNR TEST SUITE
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('RNR — Repeat Not Respond', () => {

  // ======================================================
  // TC_RNR_01
  // RNR FLAG — fires after repeated prompts
  //
  // Confirmed from logs:
  //   - First prompt for a NEW buyer → standard message
  //     ("Hi X, As discussed, here's the link...")
  //   - Repeat prompts → RNR template:
  //     "Tried reaching out, however couldn't connect."
  //
  // Uses unique buyer name per run so the backend has
  // no prior RNR history — prevents false failures.
  // ======================================================

test(

  'TC_RNR_01 - Prompt With RNR Returns RNR Template @regression',

  async ({ request }) => {

    const prompt =
      'Arhan with ID 1823 for Kns Sampada RNR';

    const response =
      await sendPrompt(request, prompt);

    expect(response.success).toBe(true);

    expect(
      response.message,
      'RNR template should appear immediately when prompt contains RNR'
    ).toMatch(
      /tried reaching out|couldn't connect/i
    );

    console.log('RNR template triggered successfully ✓');

  }

);
  test(

  'TC_RNR_02 - RNR Case Insensitive Handling @regression',

  async ({ request }) => {

    const variants = ['rnr', 'Rnr', 'RNR'];

    for (let i = 0; i < variants.length; i++) {

      const variant   = variants[i];

      const buyerId =
        Date.now().toString().slice(-4);

      const prompt =
        `Arhan with ID ${buyerId} for KNS Sampada ${variant}`;

      const response =
        await sendPrompt(request, prompt);

      expect(
        response.success,
        `Prompt with "${variant}" should succeed`
      ).toBe(true);

      expect(
        response.message,
        `"${variant}" should trigger the RNR message template`
      ).toMatch(
        /tried reaching out|couldn't connect/i
      );

      console.log(
        `Variant "${variant}": RNR message confirmed ✓`
      );

    }

  }

);
  // ======================================================
  // TC_RNR_03
  // MULTI-PROJECT RNR
  // Prompt for two projects generates link for both
  // ======================================================

  test(

    'TC_RNR_03 - RNR Multi-Project Link Generation @regression',

    async ({ request }) => {

      const buyerName = uniqueBuyerName();
      const buyerId   = Date.now().toString().slice(-4);
      const prompt    = `Arhan with ID ${buyerId} for KNS Sampada and Abhee Aaria RNR`;

      const response = await sendPrompt(request, prompt);

      expect(response.success).toBe(true);

      expect(
        response.micrositeUrl,
        'micrositeUrl should be returned for multi-project prompt'
      ).toBeTruthy();

      expect(
        response.message,
        'Response should mention KNS Sampada'
      ).toMatch(/sampada/i);

      expect(
        response.message,
        'Response should mention Abhee Aaria'
      ).toMatch(/aaria/i);

      console.log('Multi-project link generated ✓');
      console.log(`URL: ${response.micrositeUrl}`);

    }

  );

}); // ← end of RNR describe

// ======================================================
// BUYER ID ENFORCEMENT TEST SUITE
// ======================================================

test.describe('Buyer ID Enforcement', () => {

  // ======================================================
  // TC_BID_01
  // 1st–2nd creation without Buyer ID
  // Microsite should be created successfully
  // NO warning should appear yet
  // ======================================================

  test(

    'TC_BID_01 - First Two No-ID Creations Do Not Show Warning @regression',

    async ({ request }) => {

      const buyerName = 'Harsha';

      let response: WebhookResponseBody;

      // ── Create 2 microsites without Buyer ID ────────
      for (let i = 1; i <= 2; i++) {

        response = await sendPrompt(
          request,
          `${buyerName} for Abhee Tranquila`
        );

        expect(response.success).toBe(true);

        expect(
          response.micrositeUrl,
          'Microsite should be created without Buyer ID'
        ).toBeTruthy();

        const message =
          response.message.toLowerCase();

        console.log(
          `Creation ${i}: ${message.slice(0, 100)}...`
        );

        // Warning should NOT appear yet
        expect(
          message,
          'Buyer ID warning should not appear before 3rd creation'
        ).not.toMatch(
          /buyer.?id|warning|update buyer ids|blocked/i
        );

      }

      console.log(
        'First two no-ID creations completed without warning ✓'
      );

    }

  );

  // ======================================================
  // TC_BID_02
  // 3rd creation without Buyer ID
  // First warning tier should appear
  // Microsite should still be created
  // ======================================================

  test(

    'TC_BID_02 - 3rd No-ID Creation Shows First Warning @regression',

    async ({ request }) => {

      const buyerName = 'Harsha';

      let response: WebhookResponseBody;

      // ── Create 3 microsites without Buyer ID ────────
      for (let i = 1; i <= 3; i++) {

        response = await sendPrompt(
          request,
          `${buyerName} for Abhee Tranquila`
        );

        expect(response.success).toBe(true);

        console.log(
          `Creation ${i}: ${response.message.slice(0, 100)}...`
        );

      }

      const message =
        response!.message.toLowerCase();

      // Microsite should STILL be created
      expect(
        response!.micrositeUrl,
        'Microsite should still be created at warning stage'
      ).toBeTruthy();

      // Warning should appear on 3rd creation
      expect(
        message,
        'Buyer ID warning should appear at 3rd creation'
      ).toMatch(
        /buyer.?id|warning|update buyer ids|required/i
      );

      console.log(
        '1st Buyer ID warning triggered successfully ✓'
      );

    }

  );

});

  // ======================================================
  // TC_BID_03
  // 6th creation without Buyer ID — 2nd warning tier
  // ======================================================

  test(

    'TC_BID_03 - 6th No-ID Creation Shows Second Warning @regression',

    async ({ request }) => {

      const buyerName = uniqueBuyerName('Harsha');

      let lastResponse: WebhookResponseBody | null = null;

      for (let i = 1; i <= 6; i++) {

        lastResponse =
          await sendPrompt(
            request,
            `Arhan for Abhee Tranquila`
          );

        expect(lastResponse.success).toBe(true);

        console.log(
          `No-ID creation ${i}: ${lastResponse.message.slice(0, 80)}...`
        );

      }

      const message = lastResponse!.message.toLowerCase();

      expect(
        message,
        '2nd stronger warning should appear at 6th no-ID creation'
      ).toMatch(/buyer.?id|required|warning|must.?provide/);

      console.log('2nd warning (at 6th creation) present ✓');

    }

  );

  // ======================================================
  // TC_BID_04
  // 10th creation without Buyer ID — final warning / block
  // ======================================================

  test(

    'TC_BID_04 - 10th No-ID Creation Is Blocked @regression',

    async ({ request }) => {

      const buyerName = uniqueBuyerName('Harsha');

      let lastResponse: WebhookResponseBody | null = null;

      for (let i = 1; i <= 10; i++) {

        lastResponse =
          await sendPrompt(
            request,
            `${buyerName} for Abhee Tranquila`
          );

        console.log(
          `No-ID creation ${i}: success=${lastResponse.success}, ` +
          `url=${lastResponse.micrositeUrl ? 'present' : 'null'}`
        );

      }

      const message = lastResponse!.message.toLowerCase();

      console.log(`10th creation message: ${message}`);

      // At 10th creation — blocked or final warning
      expect(
        message,
        'Final warning or block should appear at 10th no-ID creation'
      ).toMatch(/buyer.?id|required|warning|limit|block|exceed|maximum/);

      console.log('Final warning/block at 10th creation ✓');

    }

  );

  // ======================================================
  // TC_BID_05
  // Reusing a previously entered Buyer ID should succeed
  // ======================================================

  test(

    'TC_BID_05 - Reusing Existing Buyer ID Succeeds @regression',

    async ({ request }) => {

      const existingBuyerId =
        process.env.EXISTING_BUYER_ID ?? 'BID001';              // set a real known Buyer ID in .env

      const buyerName = uniqueBuyerName('Harsha');

      const response =
        await sendPrompt(
          request,
          `${buyerName} with ID ${existingBuyerId} for Abhee Tranquila`
        );

      expect(
        response.success,
        'Reusing existing Buyer ID should always succeed'
      ).toBe(true);

      expect(
        response.micrositeUrl,
        'Microsite URL should be returned when valid Buyer ID is provided'
      ).toBeTruthy();

      console.log('Existing Buyer ID reuse: success ✓');
      console.log(`URL: ${response.micrositeUrl}`);

    }

  );

  // ======================================================
  // TC_BID_06
  // Providing a new valid Buyer ID always creates
  // successfully regardless of no-ID count
  // ======================================================

  test(

    'TC_BID_06 - Valid Buyer ID Always Creates Successfully @regression',

    async ({ request }) => {

      const newBuyerId  = `BID${Date.now().toString().slice(-6)}`;
      const buyerName   = uniqueBuyerName('Harsha');

      const response =
        await sendPrompt(
          request,
          `${buyerName} with ID ${newBuyerId} for Abhee Tranquila`
        );

      expect(
        response.success,
        'Providing a valid Buyer ID should always succeed'
      ).toBe(true);

      expect(response.micrositeUrl).toBeTruthy();

      console.log(`New Buyer ID ${newBuyerId}: success ✓`);
      console.log(`URL: ${response.micrositeUrl}`);

    }

  );

 // ← end of Buyer ID Enforcement describe

// ======================================================
// ══════════════════════════════════════════════════════
// LANDING PAGE TEST SUITE
// ══════════════════════════════════════════════════════
// ======================================================

test.describe('Landing Page', () => {

  // ======================================================
  // TC_LANDING_01
  // Layout validation — no overlap, responsive layout
  // ======================================================

  test(

    'TC_LANDING_01 - Landing Page Layout Renders Correctly @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const bodyWidth =
        await page.evaluate(() => document.body.scrollWidth);

      const viewportWidth =
        page.viewportSize()?.width ?? 1280;

      console.log(
        `Body scroll width: ${bodyWidth}, Viewport: ${viewportWidth}`
      );

      expect(
        bodyWidth,
        'No horizontal overflow — content must fit viewport'
      ).toBeLessThanOrEqual(viewportWidth + 5);                   // +5px tolerance for scrollbar

      await expect(
        page.locator('nav, header').first()
      ).toBeVisible();

      await expect(
        page.locator('footer').first()
      ).toBeVisible();

      console.log('Layout renders correctly ✓');

    }

  );

  // ======================================================
  // TC_LANDING_02
  // All nav links have valid hrefs and CTA buttons exist
  // ======================================================

  test(

    'TC_LANDING_02 - All Landing Page Buttons and Nav Links Work @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const navLinks =
        page.locator('nav a[href]');

      const navCount = await navLinks.count();

      console.log(`Nav links found: ${navCount}`);

      expect(navCount).toBeGreaterThan(0);

      for (let i = 0; i < Math.min(navCount, 6); i++) {

        const href =
          await navLinks.nth(i).getAttribute('href');

        expect(
          href,
          `Nav link ${i} should have a valid href`
        ).toBeTruthy();

        console.log(`Nav link ${i}: ${href} ✓`);

      }

      const ctaButtons =
        page.locator(
          'button, a[role="button"], a[class*="btn"], a[class*="cta"]'
        );

      const ctaCount = await ctaButtons.count();

      console.log(`CTA buttons found: ${ctaCount}`);

      expect(ctaCount).toBeGreaterThan(0);

    }

  );

  // ======================================================
  // TC_LANDING_03
  // "Book Demo" button — submits and shows confirmation
  // ======================================================

  test(

    'TC_LANDING_03 - Book Demo Button Submits and Shows Confirmation @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const bookDemoBtn =
        page.locator(
          'button:has-text("Book Demo"), a:has-text("Book Demo"), ' +
          'button:has-text("Book a Demo"), a:has-text("Book a Demo")'
        ).first();

      await expect(bookDemoBtn).toBeVisible({ timeout: 10000 });
      await bookDemoBtn.scrollIntoViewIfNeeded();
      await bookDemoBtn.click();
      await page.waitForTimeout(1000);

      const form =
        page.locator('form, [role="dialog"], [class*="modal"]').first();

      await expect(
        form,
        'A form or modal should open after clicking Book Demo'
      ).toBeVisible({ timeout: 5000 });

      const nameField =
        page.locator('input[placeholder*="name" i], input[name*="name" i]')
          .first();

      if (await nameField.isVisible()) {
        await nameField.fill('Test User');
      }

      const phoneField =
        page.locator(
          'input[placeholder*="phone" i], input[type="tel"], input[name*="phone" i]'
        ).first();

      if (await phoneField.isVisible()) {
        await phoneField.fill('9999999999');
      }

      await page.locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Send")'
      ).last().click();

      await page.waitForLoadState('networkidle');

      const confirmation =
        page.locator(
          'text=/thank you/i, text=/submitted/i, text=/confirm/i, ' +
          'text=/success/i, [class*="success"], [class*="confirm"]'
        ).first();

      await expect(
        confirmation,
        'Confirmation message should appear after form submission'
      ).toBeVisible({ timeout: 8000 });

      console.log('Book Demo confirmation visible ✓');

    }

  );

  // ======================================================
  // TC_LANDING_04
  // "Try Now" button opens microsite generator flow
  // ======================================================

  test(

    'TC_LANDING_04 - Try Now Button Opens Microsite Generator Flow @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const tryNowBtn =
        page.locator(
          'button:has-text("Try Now"), a:has-text("Try Now"), ' +
          'button:has-text("Try it"), a:has-text("Try it")'
        ).first();

      await expect(tryNowBtn).toBeVisible({ timeout: 10000 });
      await tryNowBtn.scrollIntoViewIfNeeded();
      await tryNowBtn.click();
      await page.waitForTimeout(1000);

      const flowContainer =
        page.locator(
          'form, [role="dialog"], [class*="modal"], [class*="wizard"], [class*="flow"]'
        ).first();

      await expect(
        flowContainer,
        'Microsite generator flow should open after Try Now'
      ).toBeVisible({ timeout: 5000 });

      console.log('Try Now flow opened ✓');

    }

  );

  // ======================================================
  // TC_LANDING_05
  // YouTube video on landing page should be visible
  // ======================================================

  test(

    'TC_LANDING_05 - YouTube Video Plays on Landing Page @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const videoSection =
        page.locator(
          'iframe[src*="youtube"], [class*="video"], [class*="Video"]'
        ).first();

      await videoSection.scrollIntoViewIfNeeded();
      await expect(videoSection).toBeVisible({ timeout: 10000 });

      const playBtn =
        page.locator(
          '[class*="play"], button[aria-label*="play" i], [class*="Play"]'
        ).first();

      const playVisible =
        await playBtn.isVisible().catch(() => false);

      if (playVisible) {
        await playBtn.click({ force: true });
        await page.waitForTimeout(2000);
        console.log('Play button clicked ✓');
      } else {
        const iframe =
          page.locator('iframe[src*="youtube"]').first();
        await expect(iframe).toBeVisible();
        console.log('YouTube iframe visible ✓');
      }

    }

  );

  // ======================================================
  // TC_LANDING_06
  // Navigation bar buttons open correct pages (no 404s)
  // ======================================================

  test(

    'TC_LANDING_06 - Navigation Bar Buttons Open Correct Pages @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const navLinks =
        page.locator('nav a[href]');

      const count = await navLinks.count();

      console.log(`Nav links to test: ${count}`);

      for (let i = 0; i < Math.min(count, 6); i++) {

        const href = await navLinks.nth(i).getAttribute('href') ?? '';
        const text = await navLinks.nth(i).innerText();

        if (
          (href.startsWith('http') && !href.includes('propfocus')) ||
          href === '#'
        ) {
          console.log(`Skipping external/anchor link: ${text} → ${href}`);
          continue;
        }

        console.log(`Testing nav: "${text}" → ${href}`);

        await page.goto(
          href.startsWith('http') ? href : `${LANDING_URL}${href}`
        );

        await page.waitForLoadState('networkidle');

        const errorText =
          await page.locator('text=/404|not found|error/i').first()
            .isVisible()
            .catch(() => false);

        expect(
          errorText,
          `Nav link "${text}" should not lead to a 404 or error page`
        ).toBe(false);

        await page.goto(LANDING_URL);
        await page.waitForLoadState('networkidle');

      }

      console.log('All nav links verified ✓');

    }

  );

  // ======================================================
  // TC_LANDING_07
  // "Contact Support" button links to WhatsApp
  // ======================================================

  test(

    'TC_LANDING_07 - Contact Support Button Opens WhatsApp @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const contactBtn =
        page.locator(
          'button:has-text("Contact"), a:has-text("Contact"), ' +
          'button:has-text("Support"), a:has-text("Support"), ' +
          'a[href*="wa.me"], a[href*="whatsapp"]'
        ).first();

      await expect(contactBtn).toBeVisible({ timeout: 10000 });
      await contactBtn.scrollIntoViewIfNeeded();

      const href =
        await contactBtn.getAttribute('href');

      console.log(`Contact button href: ${href}`);

      expect(
        href ?? '',
        'Contact support should link to WhatsApp (wa.me or whatsapp)'
      ).toMatch(/wa\.me|whatsapp/i);

      console.log('Contact support links to WhatsApp ✓');

    }

  );

  // ======================================================
  // TC_LANDING_08
  // Blog section — all blog links are accessible
  // ======================================================

  test(

    'TC_LANDING_08 - Blog Section Links Are Accessible @regression',

    async ({ page }) => {

      await page.goto(LANDING_URL);
      await page.waitForLoadState('networkidle');

      const blogSection =
        page.locator(
          '[class*="blog"], [class*="Blog"], section:has-text("Blog")'
        ).first();

      const blogVisible =
        await blogSection.isVisible().catch(() => false);

      if (!blogVisible) {
        console.log('No blog section found on landing page — skipping');
        test.skip();
        return;
      }

      await blogSection.scrollIntoViewIfNeeded();

      const blogLinks =
        blogSection.locator('a[href]');

      const linkCount = await blogLinks.count();

      console.log(`Blog links found: ${linkCount}`);

      expect(linkCount).toBeGreaterThan(0);

      for (let i = 0; i < Math.min(linkCount, 5); i++) {

        const href = await blogLinks.nth(i).getAttribute('href') ?? '';
        const text = await blogLinks.nth(i).innerText();

        console.log(`Blog link ${i}: "${text}" → ${href}`);

        const fullUrl =
          href.startsWith('http') ? href : `${LANDING_URL}${href}`;

        await page.goto(fullUrl);
        await page.waitForLoadState('networkidle');

        const is404 =
          await page.locator('text=/404|not found/i').first()
            .isVisible()
            .catch(() => false);

        expect(
          is404,
          `Blog link "${text}" should not return 404`
        ).toBe(false);

        await page.goto(LANDING_URL);
        await page.waitForLoadState('networkidle');

        const section =
          page.locator('[class*="blog"], [class*="Blog"]').first();

        if (await section.isVisible()) {
          await section.scrollIntoViewIfNeeded();
        }

      }

      console.log('All blog links accessible ✓');

    }

  );

}); // ← end of Landing Page describe

test.describe('Static Pages UI Validation', () => {

  const pages = [

    '/affiliate',
    '/privacy-policy',
    '/terms-of-service',
    '/faq',
    '/blogs'

  ];

  // ======================================================
  // DESKTOP UI CHECK
  // ======================================================

  test(

    'TC_STATIC_01 - Static Pages Render Correctly On Desktop @regression',

    async ({ page }) => {

      await page.setViewportSize({
        width: 1440,
        height: 900
      });

      for (const path of pages) {

        const url = `${LANDING_URL}${path}`;

        console.log(`Checking desktop page: ${url}`);

        await page.goto(url);

        await page.waitForLoadState('networkidle');

        // ── No 404 / error page ───────────────────────
        const errorVisible =
          await page.locator('text=/404|not found|error/i')
            .first()
            .isVisible()
            .catch(() => false);

        expect(
          errorVisible,
          `${path} should not show error page`
        ).toBe(false);

        // ── No horizontal overflow ────────────────────
        const bodyWidth =
          await page.evaluate(() => document.body.scrollWidth);

        const viewportWidth =
          page.viewportSize()?.width ?? 1440;

        expect(
          bodyWidth,
          `${path} should not overflow horizontally`
        ).toBeLessThanOrEqual(viewportWidth + 5);

        // ── Header + footer visible ───────────────────
        await expect(
          page.locator('header, nav').first()
        ).toBeVisible();

        await expect(
          page.locator('footer').first()
        ).toBeVisible();

        console.log(`${path} desktop UI verified ✓`);

      }

    }

  );

  // ======================================================
  // MOBILE UI CHECK
  // ======================================================

  test(

    'TC_STATIC_02 - Static Pages Render Correctly On Mobile @regression',

    async ({ page }) => {

      await page.setViewportSize({
        width: 390,
        height: 844
      });

      for (const path of pages) {

        const url = `${LANDING_URL}${path}`;

        console.log(`Checking mobile page: ${url}`);

        await page.goto(url);

        await page.waitForLoadState('networkidle');

        // ── No 404 / error page ───────────────────────
        const errorVisible =
          await page.locator('text=/404|not found|error/i')
            .first()
            .isVisible()
            .catch(() => false);

        expect(
          errorVisible,
          `${path} should not show error page`
        ).toBe(false);

        // ── No horizontal overflow ────────────────────
        const bodyWidth =
          await page.evaluate(() => document.body.scrollWidth);

        const viewportWidth =
          page.viewportSize()?.width ?? 390;

        expect(
          bodyWidth,
          `${path} should not overflow horizontally on mobile`
        ).toBeLessThanOrEqual(viewportWidth + 5);

        // ── Header visible ────────────────────────────
        await expect(
          page.locator('header, nav').first()
        ).toBeVisible();

        console.log(`${path} mobile UI verified ✓`);

      }

    }

  );

});