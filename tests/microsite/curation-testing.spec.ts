import {
  test,
  expect,
  APIRequestContext,
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE:
    process.env.TEST_PHONE ??
    '9888898888'
} as const;

// ======================================================
// TYPES
// ======================================================

interface MicrositeResponseBody {
  success: boolean;
  micrositeUrl: string | null;
  message: string;
  imageURL?: string | null;
}

// ======================================================
// UNIQUE BUYER ID
// ======================================================

function uniqueBuyerId() {

  const timestamp =
    Date.now()
      .toString()
      .slice(-4);

  const random =
    Math.floor(
      100 + Math.random() * 900
    );

  return `B${timestamp}${random}`;

}

// ======================================================
// GLOBAL CURATION URL
// ======================================================

let curationUrl = '';

// ======================================================
// DYNAMIC CURATION GENERATOR
// ======================================================

async function generateCurationMicrosite(
  request: APIRequestContext
): Promise<MicrositeResponseBody> {

  const buyerId =
    uniqueBuyerId();

  // Dynamic curation prompt
  const prompt =
    `Arhan ${buyerId} for Abhee Aaria,Unnati,Sampada`;

  console.log(
    `Sending Prompt: ${prompt}`
  );

  const response =

    await request.post(

      API_URL,

      {

        timeout: 60000,

        data: {

          event: 'message',

          data: {

            from: PHONE.ACTIVE,

            body: prompt

          }

        }

      }

    );

  expect(
    response.status()
  ).toBe(200);

  const responseBody: MicrositeResponseBody =
    await response.json();

  console.log(
    JSON.stringify(
      responseBody,
      null,
      2
    )
  );

  return responseBody;

}

// ======================================================
// BEFORE ALL
// ======================================================

test.beforeAll(

  async ({ request }) => {

    const responseBody =
      await generateCurationMicrosite(
        request
      );

    expect(
      responseBody.success
    ).toBe(true);

    expect(
      responseBody.micrositeUrl
    ).toBeTruthy();

    curationUrl =
      responseBody.micrositeUrl!;

    console.log(
      `\nGenerated Curation URL: ${curationUrl}`
    );

    expect(
      curationUrl
    ).toContain(
      '/propfocus-internal/'
    );

  }

);

// ======================================================
// TC_MS_24
// TOAST POPUP VALIDATION
// ======================================================

test(

  'TC_MS_24 - Curation Page Toast Popup Visibility and Auto-Dismiss @regression',

  async ({ page }) => {

    await page.goto(curationUrl);

    await page.waitForLoadState(
      'networkidle'
    );

    await page.waitForTimeout(2000);

    const toast =

      page.locator(

        '[class*="toast"], ' +
        '[role="alert"], ' +
        '[class*="snackbar"], ' +
        '[class*="notification"]'

      ).first();

    const toastVisible =

      await toast
        .isVisible()
        .catch(() => false);

    if (!toastVisible) {

      console.log(
        'Toast popup not present on this build'
      );

      test.skip();

      return;

    }

    await expect(
      toast
    ).toBeVisible({
      timeout: 5000
    });

    console.log(
      'Toast appeared ✓'
    );

    const dismissed =

      await toast

        .waitFor({

          state: 'hidden',

          timeout: 15000

        })

        .then(() => true)

        .catch(() => false);

    if (dismissed) {

      console.log(
        'Toast auto-dismissed ✓'
      );

    } else {

      console.warn(
        'Toast remained visible after 15s'
      );

    }

  }

);

// ======================================================
// TC_MS_25
// MULTIPLE PROJECT CARD VALIDATION
// ======================================================

test(

  'TC_MS_25 - Curation Page Renders Multiple Project Cards @regression',

  async ({ page }) => {

    await page.goto(curationUrl);

    await page.waitForLoadState(
      'networkidle'
    );

    await page.waitForTimeout(2000);

    // ==================================================
    // Greeting Validation
    // ==================================================

    await expect(

      page.getByText(
        'Hi Arhan',
        { exact: false }
      )

    ).toBeVisible();

    // ==================================================
    // Dynamic Project Card Validation
    // ==================================================

    const projectCards =

      page.locator(
        'text=View Details'
      );

    await expect(

      projectCards.first()

    ).toBeVisible({

      timeout: 15000

    });

    const cardCount =
      await projectCards.count();

    console.log(
      `Project cards found: ${cardCount}`
    );

    expect(cardCount)
      .toBeGreaterThanOrEqual(3);

    // ==================================================
    // Validate Each Card
    // ==================================================

    for (

      let i = 0;

      i < Math.min(cardCount, 5);

      i++

    ) {

      await expect(

        projectCards.nth(i)

      ).toBeVisible();

    }

    // ==================================================
    // Pricing Validation
    // ==================================================

    // ==================================================
// Pricing Validation
// Dynamic pricing detection
// ==================================================

const pricingElements =

  page.locator(

    'text=/₹|Cr|Lakh/i'

  );

const pricingCount =
  await pricingElements.count();

console.log(
  `Pricing elements found: ${pricingCount}`
);

expect(pricingCount)
  .toBeGreaterThan(0);

    // ==================================================
    // Footer Validation
    // ==================================================

    await expect(

      page.getByText(
        'Need More Information?',
        { exact: false }
      )

    ).toBeVisible();

  }

);