import {
  test,
  expect
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const MICROSITE_URL =
  'https://dev.propfocus.in/propfocus-internal/arhan-F0670E915';

// ======================================================
// HELPER
// ======================================================

async function captureTrackingResponse(
  page: any,
  action: () => Promise<void>
) {

  // Print all network responses for debugging
  page.on(

    'response',

    (response) => {

      console.log(
        response.url()
      );

    }

  );

  // Wait for tracking API response
  const responsePromise =
    page.waitForResponse(

      (response) =>

        response.url()
          .includes('/track')

        &&

        response.request()
          .method() === 'POST'

    );

  // Perform UI action
  await action();

  // Wait for API response
  const response =
    await responsePromise;

  // Convert response to JSON
  const responseBody =
    await response.json();

  // Print response body
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
// TC_DASH_TRACK_01
// TRACKING API STATUS VALIDATION
// ======================================================

test(
  'TC_DASH_TRACK_01 - Tracking API Status Validation @sanity',

  async ({ page }) => {

    // Open microsite
    await page.goto(
      MICROSITE_URL
    );

    // Capture tracking response
    const {
      response,
      responseBody
    } =
      await captureTrackingResponse(

        page,

        async () => {

          // Click first image
          await page
            .locator('img')
            .first()
            .click();

        }

      );

    // Validate API status
    expect(
      response.status()
    ).toBe(200);

    // Validate event type exists
    expect(
      responseBody.eventType
    ).toBeTruthy();

  }
);

// ======================================================
// TC_DASH_TRACK_02
// BROCHURE DOWNLOAD TRACKING
// ======================================================

test(
  'TC_DASH_TRACK_02 - Brochure Download Tracking @sanity',

  async ({ page }) => {

    await page.goto(
      MICROSITE_URL
    );

    const {
      response,
      responseBody
    } =
      await captureTrackingResponse(

        page,

        async () => {

          // Click brochure button
          await page
            .getByText(
              'Brochure'
            )
            .click();

        }

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBeTruthy();

  }
);

// ======================================================
// TC_DASH_TRACK_03
// MAP CLICK TRACKING
// ======================================================

test(
  'TC_DASH_TRACK_03 - Map Click Tracking @sanity',

  async ({ page }) => {

    await page.goto(
      MICROSITE_URL
    );

    const {
      response,
      responseBody
    } =
      await captureTrackingResponse(

        page,

        async () => {

          // Click maps/location section
          await page
            .locator(
              'a[href*="maps"]'
            )
            .first()
            .click();

        }

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBeTruthy();

  }
);

// ======================================================
// TC_DASH_TRACK_04
// CAROUSEL IMAGE TRACKING
// ======================================================

test(
  'TC_DASH_TRACK_04 - Carousel Tracking @regression',

  async ({ page }) => {

    await page.goto(
      MICROSITE_URL
    );

    const {
      response,
      responseBody
    } =
      await captureTrackingResponse(

        page,

        async () => {

          // Click next carousel button
          await page
            .locator(
              '.swiper-button-next'
            )
            .click();

        }

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBeTruthy();

  }
);

// ======================================================
// TC_DASH_TRACK_05
// MULTIPLE EVENT VALIDATION
// ======================================================

test(
  'TC_DASH_TRACK_05 - Multiple Event Validation @regression',

  async ({ page }) => {

    await page.goto(
      MICROSITE_URL
    );

    for (
      let i = 0;
      i < 3;
      i++
    ) {

      const {
        response
      } =
        await captureTrackingResponse(

          page,

          async () => {

            await page
              .locator('img')
              .first()
              .click();

          }

        );

      expect(
        response.status()
      ).toBe(200);

    }

  }
);

// ======================================================
// TC_DASH_TRACK_06
// PERFORMANCE TEST
// ======================================================

test(
  'TC_DASH_TRACK_06 - Tracking API Performance @performance',

  async ({ page }) => {

    await page.goto(
      MICROSITE_URL
    );

    const start =
      Date.now();

    const {
      response,
      responseBody
    } =
      await captureTrackingResponse(

        page,

        async () => {

          await page
            .locator('img')
            .first()
            .click();

        }

      );

    const ms =
      Date.now() - start;

    console.log(
      `Response Time: ${ms} ms`
    );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBeTruthy();

    expect(ms)
      .toBeLessThan(5000);

  }
);