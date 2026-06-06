import {
  test,
  expect,
  APIRequestContext
} from '@playwright/test';
const API_URL =
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE: '9999999999'
} as const;
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
  const TIER1_URL =
  'https://dev.propfocus.in/propfocus-internal/arhan-0C51F5785';
const TIER2_URL =
  'https://propfocus-internal.dev.propfocus.in/arhan-0C51F5785';
const TIER3_URL =
  'https://discover.n8npropfocus.com/arhan-FA26219B0';
test.describe(
  'Additional Domain Tests',
  () => {

    test(
      'DOMAIN_01 - Same URL Multiple Tabs',
      async ({ browser }) => {

        const context =
          await browser.newContext();

        const pages =
          await Promise.all(
            Array.from(
              { length: 10 },
              () => context.newPage()
            )
          );

        await Promise.all(
          pages.map(page =>
            page.goto(
              TIER3_URL,
              {
                waitUntil:
                  'networkidle'
              }
            )
          )
        );

        for (const page of pages) {

          await expect(
            page.locator('body')
          ).toContainText(
            'Abhee'
          );

        }

        console.log(
          'Microsite loaded successfully in 10 tabs ✓'
        );

        await context.close();

      }
    );

  }
);
test(
  'DOMAIN_02 - Same URL Multiple Devices',
  async ({ browser }) => {

    const desktopContext =
      await browser.newContext({
        viewport: {
          width: 1920,
          height: 1080
        }
      });

    const mobileContext =
      await browser.newContext({
        viewport: {
          width: 390,
          height: 844
        },
        isMobile: true,
        hasTouch: true
      });

    const desktopPage =
      await desktopContext.newPage();

    const mobilePage =
      await mobileContext.newPage();

    await Promise.all([
      desktopPage.goto(
        TIER3_URL,
        {
          waitUntil: 'networkidle'
        }
      ),
      mobilePage.goto(
        TIER3_URL,
        {
          waitUntil: 'networkidle'
        }
      )
    ]);

    await expect(
      desktopPage.locator('body')
    ).toContainText(
      'Abhee'
    );

    await expect(
      mobilePage.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Microsite accessible on desktop and mobile ✓'
    );

    await desktopContext.close();
    await mobileContext.close();

  }
);

test(
  'DOMAIN_03 - Modified Token Rejected',
  async ({ page }) => {

    const parts =
      TIER3_URL.split('-');

    const token =
      parts.pop()!;

    const modifiedToken =
      token.slice(0, -1) + 'X';

    const invalidUrl =
      `${parts.join('-')}-${modifiedToken}`;

    await page.goto(
      invalidUrl,
      {
        waitUntil: 'networkidle'
      }
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /not found|invalid|microsite/i
    );

    console.log(
      'Modified token rejected ✓'
    );

  }
);

test(
  'DOMAIN_04 - Multiple Token Characters Changed',
  async ({ page }) => {

    const parts =
      TIER3_URL.split('-');

    const token =
      parts.pop()!;

    const modifiedToken =
      token.slice(0, -3) + 'XYZ';

    const invalidUrl =
      `${parts.join('-')}-${modifiedToken}`;

    await page.goto(
      invalidUrl,
      {
        waitUntil: 'networkidle'
      }
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /not found|invalid|microsite/i
    );

    console.log(
      'Multiple token modifications rejected ✓'
    );

  }
);

test(
  'DOMAIN_05 - Half Token Removed',
  async ({ page }) => {

    const parts =
      TIER3_URL.split('-');

    const token =
      parts.pop()!;

    const shortToken =
      token.substring(
        0,
        Math.floor(token.length / 2)
      );

    const invalidUrl =
      `${parts.join('-')}-${shortToken}`;

    await page.goto(
      invalidUrl,
      {
        waitUntil: 'networkidle'
      }
    );

    await expect(
      page.locator('body')
    ).toContainText(
      /not found|invalid|microsite/i
    );

    console.log(
      'Half token removal rejected ✓'
    );

  }
);

test(
  'DOMAIN_06 - Concurrent Access',
  async ({ browser }) => {

    const context =
      await browser.newContext();

    const pages =
      await Promise.all(
        Array.from(
          { length: 20 },
          () => context.newPage()
        )
      );

    await Promise.all(
      pages.map(page =>
        page.goto(
          TIER3_URL,
          {
            waitUntil:
              'networkidle'
          }
        )
      )
    );

    for (const page of pages) {

      await expect(
        page.locator('body')
      ).toContainText(
        'Abhee'
      );

    }

    console.log(
      'Microsite handled concurrent access ✓'
    );

    await context.close();

  }
);

test(
  'DOMAIN_07 - Tier 1 Back To Projects',
  async ({ page }) => {

    await page.goto(
      TIER1_URL
    );

    // Open project details
    await page
      .getByRole('button', {
        name: /View Details/i
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    // Verify details page opened
    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    // Click Back to Projects
    await page
      .getByText(
        'Back to Projects'
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    console.log(
      'Navigated URL:',
      page.url()
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Tier 1 Back to Projects works ✓'
    );

  }
);

test(
  'DOMAIN_08 - Tier 2 Back To Projects',
  async ({ page }) => {

    await page.goto(
      TIER2_URL
    );

    await page
      .getByRole('button', {
        name: /View Details/i
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    await page
      .getByText(
        'Back to Projects'
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Tier 2 Back to Projects works ✓'
    );

  }
);

test(
  'DOMAIN_09 - Tier 3 Back To Projects',
  async ({ page }) => {

    await page.goto(
      TIER3_URL
    );

    await page
      .getByRole('button', {
        name: /View Details/i
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    await page
      .getByText(
        'Back to Projects'
      )
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Tier 3 Back to Projects works ✓'
    );

  }
);

test(
  'DOMAIN_10 - Tier 1 To Tier 2 Compatibility',
  async ({ page }) => {

    // Tier 1 should work
    await page.goto(
      TIER1_URL
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    // Convert Tier1 → Tier2
    const token =
      TIER1_URL.split('/')
        .pop();

    const tier2Url =
      `https://propfocus-internal.dev.propfocus.in/${token}`;

    await page.goto(
      tier2Url
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Tier1 → Tier2 compatibility verified ✓'
    );

  }
);

test(
  'DOMAIN_11 - Tier 2 To Tier 3 Compatibility',
  async ({ page }) => {

    await page.goto(
      TIER2_URL
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    const token =
      TIER2_URL.split('/')
        .pop();

    const tier3Url =
      `https://discover.n8npropfocus.com/${token}`;

    await page.goto(
      tier3Url
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Tier2 → Tier3 compatibility verified ✓'
    );

  }
);

test(
  'DOMAIN_12 - Tier 3 To Tier 1 Compatibility',
  async ({ page }) => {

    await page.goto(
      TIER3_URL
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    const token =
      TIER3_URL.split('/')
        .pop();

    const tier1Url =
      `https://dev.propfocus.in/propfocus-internal/${token}`;

    await page.goto(
      tier1Url
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    console.log(
      'Tier3 → Tier1 compatibility verified ✓'
    );

  }
);

test(
  'DOMAIN_14 - Generated Microsite URLs Are Unique',
  async ({ request }) => {

    const urls =
      new Set<string>();

    for (let i = 0; i < 5; i++) {

      const buyerId =
        uniqueBuyerId();

      const responseBody:
        MicrositeResponseBody =
          await sendMicrositeRequest(
            request,
            `Arhan with ID ${buyerId} for Abhee Tranquila`
          );

      expect(
        responseBody.success
      ).toBeTruthy();

      const url =
        responseBody.micrositeUrl!;

      expect(
        url
      ).toBeTruthy();

      console.log(
        `Generated URL ${i + 1}: ${url}`
      );

      urls.add(url);

    }

    expect(
      urls.size
    ).toBe(5);

    console.log(
      'All generated URLs are unique ✓'
    );

  }
);

test(
  'DOMAIN_15 - Generated Tier 1 URLs',
  async ({ request }) => {

    for (let i = 0; i < 5; i++) {

      const buyerId =
        uniqueBuyerId();

      const responseBody:
        MicrositeResponseBody =
          await sendMicrositeRequest(
            request,
            `Arhan with ID ${buyerId} for Abhee Tranquila`
          );

      expect(
        responseBody.success
      ).toBeTruthy();

      const url =
        responseBody.micrositeUrl!;

      expect(
        url
      ).toContain(
        'dev.propfocus.in/propfocus-internal'
      );

      console.log(
        `Generated Tier 1 URL ${i + 1}: ${url}`
      );

    }

    console.log(
      'All generated URLs are Tier 1 ✓'
    );

  }
);

test(
  'DOMAIN_16 - Generated Tier 3 URLs',
  async ({ request }) => {

    for (let i = 0; i < 5; i++) {

      const buyerId =
        uniqueBuyerId();

      const responseBody:
        MicrositeResponseBody =
          await sendMicrositeRequest(
            request,
            `Arhan with ID ${buyerId} for Abhee Tranquila`
          );

      expect(
        responseBody.success
      ).toBeTruthy();

      const url =
        responseBody.micrositeUrl!;

      expect(
        url
      ).toContain(
        'discover.n8npropfocus.com'
      );

      console.log(
        `Generated Tier 3 URL ${i + 1}: ${url}`
      );

    }

    console.log(
      'All generated URLs are Tier 3 ✓'
    );

  }
);

test(
  'DOMAIN_19 - Tier 1 Performance',
  async ({ page }) => {

    const startTime =
      Date.now();

    await page.goto(
      TIER1_URL,
      {
        waitUntil: 'networkidle'
      }
    );

    const loadTime =
      Date.now() - startTime;

    console.log(
      `Tier 1 Load Time: ${loadTime} ms`
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    expect(
      loadTime
    ).toBeLessThan(
      10000
    );

    console.log(
      'Tier 1 performance verified ✓'
    );

  }
);

test(
  'DOMAIN_20 - Tier 2 Performance',
  async ({ page }) => {

    const startTime =
      Date.now();

    await page.goto(
      TIER2_URL,
      {
        waitUntil: 'networkidle'
      }
    );

    const loadTime =
      Date.now() - startTime;

    console.log(
      `Tier 2 Load Time: ${loadTime} ms`
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    expect(
      loadTime
    ).toBeLessThan(
      10000
    );

    console.log(
      'Tier 2 performance verified ✓'
    );

  }
);

test(
  'DOMAIN_21 - Tier 3 Performance',
  async ({ page }) => {

    const startTime =
      Date.now();

    await page.goto(
      TIER3_URL,
      {
        waitUntil: 'networkidle'
      }
    );

    const loadTime =
      Date.now() - startTime;

    console.log(
      `Tier 3 Load Time: ${loadTime} ms`
    );

    await expect(
      page.locator('body')
    ).toContainText(
      'Abhee'
    );

    expect(
      loadTime
    ).toBeLessThan(
      10000
    );

    console.log(
      'Tier 3 performance verified ✓'
    );

  }
);

test(
  'DOMAIN_22 - Compare Tier Performance',
  async ({ browser }) => {

    async function getLoadTime(
      url: string
    ) {

      const page =
        await browser.newPage();

      const start =
        Date.now();

      await page.goto(
        url,
        {
          waitUntil:
            'networkidle'
        }
      );

      const loadTime =
        Date.now() - start;

      await page.close();

      return loadTime;

    }

    const tier1Time =
      await getLoadTime(
        TIER1_URL
      );

    const tier2Time =
      await getLoadTime(
        TIER2_URL
      );

    const tier3Time =
      await getLoadTime(
        TIER3_URL
      );

    console.log(
      `Tier 1: ${tier1Time} ms`
    );

    console.log(
      `Tier 2: ${tier2Time} ms`
    );

    console.log(
      `Tier 3: ${tier3Time} ms`
    );

    expect(
      tier1Time
    ).toBeLessThan(
      10000
    );

    expect(
      tier2Time
    ).toBeLessThan(
      10000
    );

    expect(
      tier3Time
    ).toBeLessThan(
      10000
    );

    console.log(
      'Tier performance comparison completed ✓'
    );

  }
);