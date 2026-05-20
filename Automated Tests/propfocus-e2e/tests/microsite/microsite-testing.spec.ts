import {
  test,
  expect,
  APIRequestContext,
  Page
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
// DYNAMIC BUYER ID
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

  return `AUTO${timestamp}${random}`;

}

// ======================================================
// TYPES
// ======================================================

interface MicrositeResponseBody {

  success: boolean;

  micrositeUrl:
    string | null;

  message: string;

  imageURL?:
    string | null;

}

interface TrackingResponseBody {

  success?: boolean;

  eventType?: string;

  eventName?: string;

  message?: string;

}

// ======================================================
// GLOBAL MICROSITE URL
// ======================================================

let micrositeUrl = '';

// ======================================================
// CREATE MICROSITE BEFORE ALL TESTS
// ======================================================

test.beforeAll(

  async ({ request }) => {

    const buyerId =
      uniqueBuyerId();

    const {
      responseBody
    } =
      await sendMicrositeRequest(

        request,

        `Harsha with ID ${buyerId} for Abhee Tranquila`

      );

    expect(
      responseBody.success
    ).toBe(true);

    expect(
      responseBody.micrositeUrl
    ).toBeTruthy();

    micrositeUrl =
      responseBody
        .micrositeUrl!;

    console.log(
      `Generated Microsite: ${micrositeUrl}`
    );

  }

);

// ======================================================
// MICROSITE CREATION HELPER
// ======================================================

async function sendMicrositeRequest(

  request: APIRequestContext,

  messageBody: string,

  phone: string =
    PHONE.ACTIVE

): Promise<{

  response: Awaited<
    ReturnType<
      APIRequestContext['post']
    >
  >;

  responseBody:
    MicrositeResponseBody;

}> {

  const response =
    await request.post(

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

  expect(
    response.status()
  ).toBe(200);

  const responseBody:
    MicrositeResponseBody =
      await response.json();

  console.log(

    JSON.stringify(

      responseBody,
      null,
      2

    )

  );

  return {

    response,

    responseBody

  };

}

// ======================================================
// TRACKING CAPTURE HELPER
// ======================================================

async function captureSpecificTrackingEvent(

  page: Page,

  action: () => Promise<void>,

  expectedEvent?: string

) {

  // Wait for tracking response
  const responsePromise =

    page.waitForResponse(

      async response => {

        // Correct endpoint
        if (

          !response.url()
            .includes('/api/track-event')

        ) {

          return false;

        }

        // Correct method
        if (

          response.request()
            .method() !== 'POST'

        ) {

          return false;

        }

        // Parse body safely
        const body =
          await response.json();

        console.log(
          body
        );

        // If no expected event,
        // accept first tracking event
        if (!expectedEvent) {

          return true;

        }

        // Match exact event
        return (

          body.eventType ===
          expectedEvent

        );

      },

      {
        timeout: 15000
      }

    );

  // Run click + wait together
  await Promise.all([

    responsePromise,

    action()

  ]);

  // Final response
  const response =
    await responsePromise;

  const responseBody =
    await response.json();

  return {

    response,

    responseBody

  };

}
// ======================================================
// COMMON TRACKING VALIDATION
// ======================================================

async function validateTrackingEvent(

  page: Page,

  action: () => Promise<void>

) {

  const {
    response,
    responseBody
  } =

    await captureSpecificTrackingEvent(

      page,
      action,
      'expected-event-name'

    );

  // Status validation
  expect(
    response.status()
  ).toBe(200);

  // Event validation
  expect(

    responseBody.eventType
    ??

    responseBody.eventName

  ).toBeTruthy();

  console.log(

    `Tracked Event: ${
      responseBody.eventType
      ??
      responseBody.eventName
    }`

  );

}

// ======================================================
// TC_MS_01
// BROCHURE TRACKING
// ======================================================

test(

  'TC_MS_01 - Brochure Tracking @sanity',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await page.waitForLoadState(
      'networkidle'
    );

    const brochureButton =

      page
        .getByRole(

          'button',

          {
            name: 'View brochure'
          }

        )
        .first();

    await brochureButton
      .scrollIntoViewIfNeeded();

    // Capture brochure tracking
    const {
      responseBody
    } =

      await captureSpecificTrackingEvent(

        page,

        async () => {

          await brochureButton
            .click();

        }

      );

    console.log(
      `Tracked Event: ${responseBody.eventType}`
    );

    // Validate event exists
    expect(

      responseBody.eventType

    ).toBeTruthy();

  }

);

// ======================================================
// TC_MS_02
// SITE VISIT TRACKING
// ======================================================

test(

  'TC_MS_02 - Site Visit Tracking @sanity',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await validateTrackingEvent(

      page,

      async () => {

        const siteVisitButton =

          page
            .getByRole(

              'button',

              {
                name: 'Book Site Visit'
              }

            );

        await siteVisitButton
          .scrollIntoViewIfNeeded();

        await siteVisitButton
          .click();

      }

    );

  }

);

// ======================================================
// TC_MS_03
// IMAGE TRACKING
// ======================================================

test(

  'TC_MS_03 - Image Tracking @sanity',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await validateTrackingEvent(

      page,

      async () => {

        await page
          .locator('img')
          .nth(1)
          .click();

      }

    );

  }

);

// ======================================================
// TC_MS_04
// MOBILE UI VALIDATION
// ======================================================

test(

  'TC_MS_04 - Mobile UI Validation @regression',

  async ({ page }) => {

    await page.setViewportSize({

      width: 390,
      height: 844

    });

    await page.goto(
      micrositeUrl
    );

    await expect(

      page.locator('img')
        .first()

    ).toBeVisible();

    await expect(

      page.getByRole(

        'button',

        {
          name: 'View brochure'
        }

      ).first()

    ).toBeVisible();

  }

);

// ======================================================
// TC_MS_05
// IMAGE API VALIDATION
// ======================================================

test(

  'TC_MS_05 - Image API Should Not Return 400 @regression',

  async ({ page }) => {

    const failedResponses:
      string[] = [];

    page.on(

      'response',

      response => {

        const url =
          response.url();

        const status =
          response.status();

        if (

          url.match(
            /\.(png|jpg|jpeg|webp)/i
          )

          &&

          status === 400

        ) {

          console.log(
            `Broken Image: ${url}`
          );

          failedResponses.push(
            url
          );

        }

      }

    );

    await page.goto(
      micrositeUrl
    );

    await page.waitForTimeout(
      5000
    );

    expect(
      failedResponses.length
    ).toBe(0);

  }

);

// ======================================================
// TC_MS_06
// PERFORMANCE TEST
// ======================================================

test(

  'TC_MS_06 - Microsite Performance @performance',

  async ({ page }) => {

    const start =
      Date.now();

    await page.goto(
      micrositeUrl
    );

    await page.waitForLoadState(
      'networkidle'
    );

    const ms =
      Date.now() - start;

    console.log(
      `Load Time: ${ms} ms`
    );

    expect(ms)
      .toBeLessThan(5000);

  }

);

// ======================================================
// TC_MS_07
// UI ELEMENT VALIDATION
// ======================================================

test(

  'TC_MS_07 - UI Elements Validation @regression',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await expect(

      page.locator('img')
        .first()

    ).toBeVisible();

    await expect(

      page.getByRole(

        'button',

        {
          name: 'View brochure'
        }

      ).first()

    ).toBeVisible();

    await expect(

      page.locator('body')

    ).toContainText(
      'Abhee'
    );

  }

);

// ======================================================
// TC_MS_08
// NAVIGATION TAB TRACKING
// ======================================================

test(

  'TC_MS_08 - Navigation Tracking @regression',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await validateTrackingEvent(

      page,

      async () => {

        await page
          .getByText(
            'Amenities'
          )
          .click();

      }

    );

  }

);