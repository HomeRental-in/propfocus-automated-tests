import {                        // imports the necessary functions and types from the Playwright testing library
  test,                         // test: function to define test cases
  expect,                       // expect: function for assertions/validations
  APIRequestContext,             // APIRequestContext: type for making HTTP API requests (used in beforeAll)
  Page                          // Page: type representing a single browser tab
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const API_URL =                                                    // WhatsApp webhook used to generate the microsite before tests run
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE:
    process.env.TEST_PHONE ??
    '9888898888'
} as const;

const TRACKING_API = '/api/track-event';                           // partial URL used to match tracking calls in the network tab

const EVENT = {

  // ======================================================
  // PAGE / SESSION EVENTS
  // ======================================================

  LINK_OPEN:            'link_open',

  PAGE_VIEW:            'page_view',

  REVISITED_LINK:       'revisited_link',

  PROJECT_DETAILS:      'project_details_viewed',

  // ======================================================
  // CTA EVENTS
  // ======================================================

  BROCHURE_VIEWED:      'download_brochure',

  FLIPBOOK:             'Flipbook_viewed',

  SITE_VISIT_CLICKED:   'book_site_visit',

  MAP_OPENED:           'maps_cta_clicked',

  URL_SHARED:           'url_shared',

  SHARE_CLICKED:        'share_clicked',

  INVENTORY_REQUESTED:  'contact_wa_call',

  PHONE_CLICKED:        'contact_wa_call',   

  // ======================================================
  // MEDIA EVENTS
  // ======================================================

  IMAGE_CLICKED:        'gallery_viewed',

  THUMBNAIL_CLICKED:    'thumbnail_clicked',

  FLOORPLAN:            'floorplan',

  VIDEO_PLAYED:         'youtube_clicked',

  TESTIMONIAL:          'testimonial',

  // ======================================================
  // NAVIGATION EVENTS
  // ======================================================

  NAV_CLICKED:          'nav_clicked',

  UNIT_CONFIG_CLICKED:  'unit_config_clicked',

  PHASE_CHANGED:        'phase_changed',

  // ======================================================
  // DOCUMENT / CERTIFICATE EVENTS
  // ======================================================

  RERA_CERTIFICATE:     'rera_certificate_viewed',

} as const;

// ======================================================
// TYPES
// ======================================================

interface MicrositeResponseBody {                                   // shape of the JSON returned by the microsite generation webhook
  success:      boolean;
  micrositeUrl: string | null;
  message:      string;
  imageURL?:    string | null;
}

interface TrackingResponseBody {                                    // shape of the JSON returned by the tracking API
  eventType?:  string;                                             // the type of event tracked — must exactly match EVENT constants
  eventName?:  string;                                             // fallback field name some events may use instead of eventType
  success?:    boolean;
  message?:    string;
}

// ======================================================
// DYNAMIC BUYER ID
// ======================================================

function uniqueBuyerId() {                                         // generates a unique buyer ID for each test run to avoid microsite reuse conflicts

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
// GLOBAL MICROSITE URL
// Set once in beforeAll, reused across all tests
// ======================================================

let micrositeUrl = '';                                             // holds the live microsite URL created by beforeAll — all tests run against this

// ======================================================
// MICROSITE CREATION HELPER
// ======================================================

async function sendMicrositeRequest(                               // sends a POST to the WhatsApp webhook to generate a microsite, same flow as the real WhatsApp integration
  request:     APIRequestContext,
  messageBody: string,
  phone:       string = PHONE.ACTIVE
): Promise<{
  response: Awaited<
    ReturnType<APIRequestContext['post']>
  >;
  responseBody: MicrositeResponseBody;
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

  const responseBody: MicrositeResponseBody =
    await response.json();

  console.log(
    JSON.stringify(responseBody, null, 2)
  );

  return {
    response,
    responseBody
  };

}

// ======================================================
// CREATE MICROSITE BEFORE ALL TESTS
// Runs once before any test. Generates a real microsite
// via webhook so all tests run against a live URL.
// ======================================================

test.beforeAll(

  async ({ request }) => {

    const buyerId = uniqueBuyerId();

    const { responseBody } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee Tranquila`
      );

    expect(
      responseBody.success
    ).toBe(true);                                                  // if microsite creation fails here, all tests are blocked — surface the error early

    expect(
      responseBody.micrositeUrl
    ).toBeTruthy();

    micrositeUrl = responseBody.micrositeUrl!;                     // store the URL — every test below will open this URL in the browser

    console.log(
      `\nGenerated Microsite: ${micrositeUrl}`
    );

  }

);

// ======================================================
// TRACKING CAPTURE HELPER
// Uses page.waitForResponse so we can pass a timeout.
// The listener is set up BEFORE the action is run so
// fast events are never missed.
// For buttons that open a new tab (e.g. "View brochure")
// the tracking call fires BEFORE navigation away, so
// page.waitForResponse still catches it in time.
// ======================================================

async function captureTrackingEvent(                               // intercepts the next tracking POST that matches expectedEvent
  page:          Page,                                             // the current page — tracking fires before any new tab opens
  action:        () => Promise<void>,                              // the UI interaction that should fire the tracking call
  expectedEvent: string                                            // the exact eventType value we expect in the response body
): Promise<{
  response:      Awaited<ReturnType<Page['waitForResponse']>>;
  responseBody:  TrackingResponseBody;
}> {

  // Set up the listener BEFORE the action so fast events are never missed
  const responsePromise =
    page.waitForResponse(

      async response => {

        if (
          !response.url().includes(TRACKING_API) ||
          response.request().method() !== 'POST'
        ) {
          return false;                                            // ignore all non-tracking calls
        }

        try {

          const body: TrackingResponseBody =
            await response.json();

          console.log(
            `Intercepted: ${body.eventType ?? body.eventName}`
          );

          return (
            body.eventType === expectedEvent ||
            body.eventName === expectedEvent                       // check both field names in case API uses either
          );

        } catch {
          return false;                                            // skip responses whose body is not valid JSON
        }

      },

      { timeout: 15000 }                                          // 15 seconds — enough for slow networks, avoids the 30s default hang

    );

  await action();                                                  // perform the UI action AFTER the listener is registered

  const response = await responsePromise;                         // one await — no double-resolve, no race condition

  const responseBody: TrackingResponseBody =
    await response.json();

  console.log(
    JSON.stringify(responseBody, null, 2)
  );

  return {
    response,
    responseBody
  };

}

// ======================================================
// TC_MS_01
// BROCHURE BUTTON TRACKING
// Button: "View brochure" (gold button, top of page)
// ======================================================

test(

  'TC_MS_01 - Brochure Button Tracking @sanity',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const brochureButton =
      page
        .getByRole('button', { name: 'View brochure' })
        .first();

    await brochureButton
      .scrollIntoViewIfNeeded();

    const { response, responseBody } =
      await captureTrackingEvent(

        page,                                                   // context survives the new tab that "View brochure" opens

        async () => {
          await brochureButton.click();
        },

        EVENT.BROCHURE_VIEWED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.BROCHURE_VIEWED);                                 // must be exactly 'download_brochure' — confirmed from network logs

  }

);

// ======================================================
// TC_MS_02
// BOOK SITE VISIT BUTTON TRACKING
// Button: "Book Site Visit" (outlined button, top of page)
// ======================================================

test(

  'TC_MS_02 - Book Site Visit Button Tracking @sanity',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const siteVisitButton =
      page
        .getByRole('button', { name: 'Book Site Visit' })
        .first();

    await siteVisitButton
      .scrollIntoViewIfNeeded();

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await siteVisitButton.click();
        },

        EVENT.SITE_VISIT_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.SITE_VISIT_CLICKED);

  }

);

// ======================================================
// TC_MS_03
// GALLERY IMAGE CLICK TRACKING
// Element: gallery images in the image grid section
// ======================================================

test(

  'TC_MS_03 - Gallery Image Click Tracking @sanity',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await page
            .locator('img')
            .nth(1)                                                // nth(1) skips the logo — targets the first actual content image
            .click();
        },

        EVENT.IMAGE_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.IMAGE_CLICKED);

  }

);

// ======================================================
// TC_MS_04
// CAROUSEL THUMBNAIL CLICK TRACKING
// Element: small thumbnail images below the main carousel image
// ======================================================

test(

  'TC_MS_04 - Carousel Thumbnail Click Tracking @sanity',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await page
            .locator('.swiper-slide img, [class*="thumbnail"] img')
            .nth(1)                                                // click the second thumbnail — first one is already active
            .click();
        },

        EVENT.THUMBNAIL_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.THUMBNAIL_CLICKED);

  }

);

// ======================================================
// TC_MS_05
// YOUTUBE VIDEO PLAY TRACKING
// Section: "Experience the Project" — YouTube embed
// ======================================================

test(

  'TC_MS_05 - YouTube Video Play Tracking @sanity',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const videoSection =
      page.getByText('Experience the Project');

    await videoSection
      .scrollIntoViewIfNeeded();

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {

          // The play button is an SVG overlay (z-20 div) that sits on top of the
          // YouTube thumbnail img. Clicking the img directly gets intercepted by
          // the overlay. We click the overlay container itself using { force: true }
          // to skip Playwright's pointer-interception check.
          await page
            .locator(
              '[class*="video"] [class*="flex"][class*="items-center"][class*="justify-center"], [class*="video"] [class*="play"]'
            )
            .first()
            .click({ force: true });                              // force bypasses the SVG polygon intercepting pointer events

        },

        EVENT.VIDEO_PLAYED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.VIDEO_PLAYED);

  }

);

// ======================================================
// TC_MS_06
// OPEN IN MAPS TRACKING
// Section: Location — the "Open in Maps" button rendered
// as an overlay ON TOP of the Google Maps embed.
// Note: getByText('Open in Maps') fails because that text
// lives inside the Google Maps iframe which Playwright
// cannot access cross-origin. The actual clickable element
// is an anchor tag overlaid on the map container.
// ======================================================

test(

  'TC_MS_06 - Open in Maps Click Tracking @sanity',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    // Scroll directly to the map anchor overlay — no nav click needed
    const mapLink =
      page
        .locator(
          'a[href*="maps.google"], a[href*="goo.gl"], a[target="_blank"][href*="map"]'
        )
        .first();

    await mapLink
      .scrollIntoViewIfNeeded();                                  // bring the map section into view before clicking

    await page.waitForTimeout(300);                               // brief pause for any scroll animations to settle

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {

          // mapLink is already scrolled into view above —
          // click it directly without re-querying
          await mapLink
            .click();                                             // clicks the "Open in Maps" anchor overlay on the map container

        },

        EVENT.MAP_OPENED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.MAP_OPENED);

  }

);

// ======================================================
// TC_MS_07
// NAVIGATION TAB TRACKING
// Element: top nav tabs — Overview, Experience, Units,
// Pricing, Amenities, Location, About Builder
// ======================================================

const navTabs = [                                                  // all navigation tabs visible in the top bar of the microsite
  'Overview',
  'Experience',
  'Units',
  'Pricing',
  'Amenities',
  'Location',
  'About Builder',
];

for (const tab of navTabs) {

  test(

    `TC_MS_07 - Nav Tab Tracking: "${tab}" @regression`,

    async ({ page }) => {

      await page.goto(micrositeUrl);

      await page.waitForLoadState('networkidle');

      const { response, responseBody } =
        await captureTrackingEvent(

          page,

          async () => {
            await page
              .getByRole('link', { name: tab })
              .first()
              .click();                                           // click each nav tab to verify it fires a NAV_CLICKED tracking event
          },

          EVENT.NAV_CLICKED

        );

      expect(
        response.status()
      ).toBe(200);

      expect(
        responseBody.eventType
      ).toBe(EVENT.NAV_CLICKED);

    }

  );

}

// ======================================================
// TC_MS_08
// UNIT CONFIGURATION TAB TRACKING
// Section: "Unit Configurations" — tabs: Plots, 30×40 ft, 30×50 ft
// ======================================================

test(

  'TC_MS_08 - Unit Config Tab "Plots" Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    await page
      .getByText('Units')
      .first()
      .click();                                                   // navigate to Units section first

    await page.waitForTimeout(500);

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await page
            .getByRole('button', { name: 'Plots' })
            .click();
        },

        EVENT.UNIT_CONFIG_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.UNIT_CONFIG_CLICKED);

  }

);

test(

  'TC_MS_09 - Unit Config Size "30×40 ft" Tab Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    await page
      .getByText('Units')
      .first()
      .click();

    await page.waitForTimeout(500);

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await page
            .getByText('30×40 ft')
            .click();                                             // click the 30×40 ft size tab under Unit Configurations
        },

        EVENT.UNIT_CONFIG_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.UNIT_CONFIG_CLICKED);

  }

);

// ======================================================
// TC_MS_10
// SHARE PROJECT BUTTON TRACKING
// Section: Unit Configurations — "Share Project" button
// ======================================================

test(

  'TC_MS_10 - Share Project Button Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    await page
      .getByText('Units')
      .first()
      .click();

    await page.waitForTimeout(500);

    const shareButton =
      page.getByRole('button', { name: 'Share Project' });

    await shareButton
      .scrollIntoViewIfNeeded();

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await shareButton.click();
        },

        EVENT.SHARE_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.SHARE_CLICKED);

  }

);

// ======================================================
// TC_MS_11
// REQUEST LIVE INVENTORY BUTTON TRACKING
// Section: "Still Have a Question?" — "Request Live Inventory" button
// ======================================================

test(

  'TC_MS_11 - Request Live Inventory Button Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const inventoryButton =
      page.getByRole('button', { name: 'Request Live Inventory' });

    await inventoryButton
      .scrollIntoViewIfNeeded();

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await inventoryButton.click();
        },

        EVENT.INVENTORY_REQUESTED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.INVENTORY_REQUESTED);

  }

);

// ======================================================
// TC_MS_12
// PHONE BUTTON TRACKING
// Button: "+91 83740 95506" (gold button, top right and contact section)
// ======================================================

test(

  'TC_MS_12 - Phone Button Click Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    const phoneButton =
      page.locator('a[href^="tel:"]')
        .first();

    await expect(phoneButton).toBeVisible();                             // ensure the phone button is visible before trying to click it

    await phoneButton
      .scrollIntoViewIfNeeded();

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {
          await phoneButton.click();
        },

        EVENT.PHONE_CLICKED

      );

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.PHONE_CLICKED);

  }

);

// ======================================================
// TC_MS_13
// RERA CERTIFICATE TRACKING
// Button: "View Certificate" link next to RERA Status: Registered
// ======================================================

test(

  'TC_MS_13 - RERA View Certificate Tracking @regression',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await page.waitForLoadState(
      'networkidle'
    );

    const certButton =

      page.getByRole(

        'button',

        {
          name: 'View Certificate'
        }

      );

    await expect(
      certButton
    ).toBeVisible();

    await certButton
      .scrollIntoViewIfNeeded();

    let trackingFound = false;

    page.on(

      'response',

      async response => {

        if (

          response.url().includes(
            TRACKING_API
          )

        ) {

          try {

            const body =
              await response.json();

            console.log(
              `Intercepted: ${body.eventType}`
            );

            if (

              body.eventType ===
              EVENT.RERA_CERTIFICATE

            ) {

              trackingFound = true;

            }

          } catch {}

        }

      }

    );

    await certButton.click({
      force: true
    });

    await page.waitForTimeout(5000);

    expect(

      trackingFound,

      'RERA certificate tracking event is missing'

    ).toBe(true);

  }

);

// ======================================================
// TC_MS_14
// MOBILE UI VALIDATION
// Validates layout on iPhone 14 viewport (390×844)
// ======================================================

test(

  'TC_MS_14 - Mobile UI Validation @regression',

  async ({ page }) => {

    await page.setViewportSize({
      width:  390,
      height: 844                                                  // iPhone 14 dimensions — standard mobile test size
    });

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('img').first()
    ).toBeVisible();                                               // at least one image must be visible on mobile

    await expect(
      page
        .getByRole('button', { name: 'View brochure' })
        .first()
    ).toBeVisible();                                               // brochure button must be visible and not hidden behind overflow

    await expect(
      page
        .getByRole('button', { name: 'Book Site Visit' })
        .first()
    ).toBeVisible();                                               // site visit button must be visible on mobile

    await expect(
      page.getByText('Abhee Tranquila').first()
    ).toBeVisible();                                               // project name must be visible — confirms content loaded correctly

    const bodyWidth =
      await page.evaluate(
        () => document.body.scrollWidth                            // measure actual rendered content width
      );

    expect(bodyWidth)
      .toBeLessThanOrEqual(390);                                   // no horizontal overflow allowed on mobile — scrollWidth must not exceed viewport

  }

);

// ======================================================
// TC_MS_15
// IMAGE 400 ERROR CHECK
// Validates that no image on the microsite returns a
// 400 HTTP error — a 400 means the src URL is broken
// ======================================================

test(

  'TC_MS_15 - No Image Should Return 400 Error @regression',

  async ({ page }) => {

    const failedImages: string[] = [];                             // collect URLs of any broken images found during page load

    page.on(

      'response',

      response => {

        const url    = response.url();
        const status = response.status();

        const isImage =
          url.match(/\.(png|jpg|jpeg|webp|svg|gif)/i) ||          // detect image by file extension
          response
            .headers()['content-type']
            ?.includes('image');                                  // also detect by content-type for extensionless image URLs

        if (isImage && status === 400) {

          console.log(
            `Broken Image [${status}]: ${url}`
          );

          failedImages.push(url);

        }

      }

    );

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');                    // wait for all images to finish loading before checking

    await page.waitForTimeout(2000);                              // extra buffer for any lazy-loaded images

    expect(
      failedImages.length
    ).toBe(0);                                                    // zero broken images allowed — any 400 is a failure

  }

);

// ======================================================
// TC_MS_16
// UI ELEMENTS VALIDATION (DESKTOP)
// Validates all key sections and elements are visible
// ======================================================

test(

  'TC_MS_16 - UI Elements Validation Desktop @regression',

  async ({ page }) => {

    await page.goto(
      micrositeUrl
    );

    await page.waitForLoadState(
      'networkidle'
    );

    // ======================================================
    // HERO SECTION
    // ======================================================

    // Main project/carousel image
    await expect(

      page.locator(
        'img[src*="projects"]'
      ).first()

    ).toBeVisible();

    // Project title exists
    // (dynamic project-safe validation)
    await expect(

      page.locator(
        'h1, h2'
      ).first()

    ).toBeVisible();

    // Pricing section visible
    await expect(

      page
        .getByText('Starting Price')
        .first()

    ).toBeVisible();

    // ======================================================
    // CTA BUTTONS
    // ======================================================

    await expect(

      page
        .getByRole(
          'button',
          {
            name: 'View brochure'
          }
        )
        .first()

    ).toBeVisible();

    await expect(

      page
        .getByRole(
          'button',
          {
            name: 'Book Site Visit'
          }
        )
        .first()

    ).toBeVisible();

    // ======================================================
    // PROJECT INFO SECTION
    // ======================================================

    await expect(

      page
        .getByText('Configurations')
        .first()

    ).toBeVisible();

    await expect(

      page
        .getByText('RERA Status')
        .first()

    ).toBeVisible();

    await expect(

      page
        .getByRole(
          'button',
          {
            name: 'View Certificate'
          }
        )

    ).toBeVisible();

    // ======================================================
    // NAVIGATION TABS
    // ======================================================

    for (

      const tab of [

        'Overview',

        'Experience',

        'Units',

        'Pricing',

        'Amenities',

        'Location',

        'About Builder'

      ]

    ) {

      await expect(

        page
          .getByText(tab)
          .first()

      ).toBeVisible();

    }

    // ======================================================
    // LOCATION SECTION
    // ======================================================

    await expect(

      page
        .getByText('Location')
        .first()

    ).toBeVisible();

    // Google Maps iframe visible
    await expect(

      page
        .locator('iframe')
        .first()

    ).toBeVisible();

    // ======================================================
    // CONTACT SECTION
    // ======================================================

    await expect(

      page
        .getByText('Still Have a Question?')
        .first()

    ).toBeVisible();

    await expect(

      page
        .getByText('Request Live Inventory')
        .first()

    ).toBeVisible();

  }

);

// ======================================================
// TC_MS_17
// PERFORMANCE TEST
// Measures full page load time — must be under 5 seconds
// ======================================================

test(

  'TC_MS_17 - Microsite Load Performance @sanity',

  async ({ page }) => {

    const start = Date.now();                                      // record time before navigation begins

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');                    // wait until all network requests finish — represents fully loaded state

    const ms = Date.now() - start;

    console.log(
      `Load Time: ${ms} ms`
    );

    expect(ms)
      .toBeLessThan(5000);                                        // full page load must complete within 5 seconds

  }

);

// ======================================================
// NEW TEST CASES — append after TC_MS_17
// Covers: link_open, revisited_link, flipbook, floorplan,
//         phase_changed, testimonial events, plus
//         curation-page UI and carousel navigation
// ======================================================

// ======================================================
// TC_MS_18
// LINK_OPEN EVENT — fires on first page load
// Captured via waitForResponse BEFORE goto completes
// ======================================================

test(

  'TC_MS_18 - Link Open Event on First Visit @sanity',

  async ({ page }) => {

    // Register the listener before navigation so we catch
    // the event that fires immediately on page load
    const responsePromise =
      page.waitForResponse(

        async response => {

          if (
            !response.url().includes(TRACKING_API) ||
            response.request().method() !== 'POST'
          ) return false;

          try {
            const body: TrackingResponseBody = await response.json();
            console.log(`Intercepted: ${body.eventType ?? body.eventName}`);
            return (
              body.eventType === EVENT.LINK_OPEN ||
              body.eventName === EVENT.LINK_OPEN
            );
          } catch {
            return false;
          }

        },

        { timeout: 15000 }

      );

    await page.goto(micrositeUrl);

    const response = await responsePromise;
    const responseBody: TrackingResponseBody = await response.json();

    console.log(JSON.stringify(responseBody, null, 2));

    expect(response.status()).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.LINK_OPEN);                                       // 'link_open' must fire on the very first page load

  }

);

// ======================================================
// TC_MS_19
// REVISITED_LINK EVENT
//
// Root cause analysis:
//   - micrositeUrl is freshly generated each run via
//     beforeAll → always treated as first visit by backend
//   - A new browser context wipes client state → link_open
//   - Same context second goto → still link_open because
//     the URL itself is brand-new to the backend
//   - Conclusion: visited state is SERVER-SIDE, keyed by
//     phone number + microsite URL. A newly generated URL
//     can NEVER fire revisited_link in the same test run.
//
// Solution:
//   Use a KNOWN previously-visited URL stored in an env
//   var. If the env var is absent the test is skipped
//   with a clear message rather than failing.
//
// To populate the env var:
//   1. Run any test that generates a microsite URL.
//   2. Copy the printed "Generated Microsite:" URL.
//   3. Set it in your .env or CI secrets:
//        REVISITED_MICROSITE_URL=https://dev.propfocus.in/propfocus-internal/harsha-XXXXXXX
//   4. Re-run this test — the backend will now recognise
//      the URL + phone combo as a repeat visitor.
// ======================================================

test(

  'TC_MS_19 - Revisited Link Event on Second Navigation @regression',

  async ({ page }) => {

    const revisitUrl =

      process.env.REVISITED_MICROSITE_URL ??

      'https://dev.propfocus.in/propfocus-internal/harsha-77DA0717D';

    if (!revisitUrl) {

      console.log(

        'SKIP: REVISITED_MICROSITE_URL env var not set.\n' +

        'Copy a previously-generated micrositeUrl into that var and re-run.'

      );

      test.skip();

      return;

    }

    console.log(
      `Revisiting known URL: ${revisitUrl}`
    );

    const responsePromise =

      page.waitForResponse(

        async response => {

          if (

            !response.url().includes(TRACKING_API) ||

            response.request().method() !== 'POST'

          ) {

            return false;

          }

          try {

            const body: TrackingResponseBody =

              await response.json();

            console.log(

              `Intercepted: ${body.eventType ?? body.eventName}`

            );

            return (

              body.eventType === 'revisited_link' ||

              body.eventName === 'revisited_link'

            );

          } catch {

            return false;

          }

        },

        {
          timeout: 15000
        }

      );

    await page.goto(revisitUrl);

    await page.waitForLoadState(
      'networkidle'
    );

    const response =
      await responsePromise;

    const responseBody: TrackingResponseBody =

      await response.json();

    console.log(
      JSON.stringify(
        responseBody,
        null,
        2
      )
    );

    expect(
      response.status()
    ).toBe(200);

    expect(

      responseBody.eventType

    ).toBe(
      'revisited_link'
    );

  }

);


// ======================================================
// TC_MS_20
// FLIPBOOK VIEW EVENT TRACKING
// ======================================================

test(

  'TC_MS_20 - Flipbook View Event Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState(
      'networkidle'
    );

    await page.waitForTimeout(2000);

    // ==================================================
    // View Brochure button
    // ==================================================

    const brochureButton =

      page.getByRole(

        'button',

        {
          name: /View brochure/i
        }

      ).first();

    await expect(
      brochureButton
    ).toBeVisible();

    // ==================================================
    // Capture flipbook event
    // ==================================================

    const { response, responseBody } =

      await captureTrackingEvent(

        page,

        async () => {

          const popupPromise =
            page.waitForEvent('popup');

          await brochureButton.click({
            force: true
          });

          const popup =
            await popupPromise;

          await popup.waitForLoadState();

          console.log(
            'Flipbook popup opened'
          );

        },

        EVENT.FLIPBOOK

      );

    console.log(
      JSON.stringify(responseBody, null, 2)
    );

    // ==================================================
    // Assertions
    // ==================================================

    expect(
      response.status()
    ).toBe(200);

    expect(
      responseBody.eventType
    ).toBe(EVENT.FLIPBOOK);

    console.log(
      'Flipbook tracking event validated ✓'
    );

  }

);
// ======================================================
// TC_MS_21
// FLOORPLAN EVENT
// Confirmed event name from logs: 'floorplan_checked'
// Clicking the floorplan element opens a new tab which
// closes the original page — same pattern as TC_MS_13.
// Fix: use page.on('response') listener instead of
// captureTrackingEvent, then click and wait.
// ======================================================

test(

  'TC_MS_21 - Floorplan Viewed Event Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    await page.getByText('Units').first().click();
    await page.waitForTimeout(500);

    const floorplanEl =
      page
        .locator(
          '[class*="floorplan"], [class*="floor-plan"], button:has-text("Floor Plan"), img[alt*="floor" i], img[alt*="plan" i]'
        )
        .first();

    await floorplanEl.scrollIntoViewIfNeeded();

    let trackingFound = false;

    page.on(

      'response',

      async response => {

        if (!response.url().includes(TRACKING_API)) return;

        try {

          const body: TrackingResponseBody =
            await response.json();

          console.log(`Intercepted: ${body.eventType}`);

          if (body.eventType === 'floorplan_checked') {
            trackingFound = true;
          }

        } catch {}

      }

    );

    await floorplanEl.click({ force: true });

    await page.waitForTimeout(5000);                              // wait for tracking call to fire after click

    expect(
      trackingFound,
      'floorplan_checked tracking event not fired'
    ).toBe(true);

  }

);
// ======================================================
// TC_MS_22
// PHASE_CHANGED EVENT — fires when the user switches
// between project phases (Phase 1 / Phase 2 etc.) if
// the project has multiple phases
// ======================================================

test(

  'TC_MS_22 - Phase Changed Event Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {

          // Phase switcher tabs — labelled "Phase 1", "Phase 2", etc.
          const phaseTab =
            page
              .locator(
                'button:has-text("Phase"), [class*="phase"] button, [role="tab"]:has-text("Phase")'
              )
              .nth(1);                                            // nth(1) = second tab i.e. switch TO a different phase

          await phaseTab.scrollIntoViewIfNeeded();
          await phaseTab.click();

        },

        'phase_changed'

      );

    expect(response.status()).toBe(200);

    expect(
      responseBody.eventType
    ).toBe('phase_changed');

  }

);

// ======================================================
// TC_MS_23
// TESTIMONIAL EVENT — fires when the user clicks /
// interacts with a testimonial card or "Read more"
// in the testimonials section
// ======================================================

test(

  'TC_MS_23 - Testimonial Interaction Event Tracking @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);
    await page.waitForLoadState('networkidle');

    const { response, responseBody } =
      await captureTrackingEvent(

        page,

        async () => {

          const testimonialEl =
            page
              .locator(
                '[class*="testimonial"], [class*="review"], blockquote, [class*="quote"]'
              )
              .first();

          await testimonialEl.scrollIntoViewIfNeeded();
          await testimonialEl.click({ force: true });

        },

        'testimonial'

      );

    expect(response.status()).toBe(200);

    expect(
      responseBody.eventType
    ).toBe('testimonial');

  }

);

// ======================================================
// TC_MS_26
// PROJECT DETAILS PAGE — CAROUSEL IMAGE NAVIGATION
// ======================================================

test(
  'TC_MS_26 - Carousel Image Navigation @regression',

  async ({ page }) => {

    await page.goto(micrositeUrl);

    await page.waitForLoadState('networkidle');

    // ==================================================
    // Main Carousel Image
    // ==================================================

    const carouselImage = page
      .locator('img[src*="projects"]')
      .first();

    await expect(carouselImage)
      .toBeVisible();

    const initialSrc =
      await carouselImage.getAttribute('src');

    console.log(
      `Initial image: ${initialSrc}`
    );

    // ==================================================
    // Thumbnail Images
    // ==================================================

    const thumbnails = page.locator(
      'div img[src*="projects"]'
    );

    // Click second thumbnail
    await thumbnails
      .nth(2)
      .click();

    // Wait for image change
    await expect(async () => {

      const updatedSrc =
        await carouselImage.getAttribute('src');

      expect(updatedSrc)
        .not.toBe(initialSrc);

    }).toPass({
      timeout: 5000
    });

    const secondSrc =
      await carouselImage.getAttribute('src');

    console.log(
      `After thumbnail click: ${secondSrc}`
    );

    // ==================================================
    // Return to first image
    // ==================================================

    await thumbnails
      .nth(1)
      .click();

    await expect(async () => {

      const updatedSrc =
        await carouselImage.getAttribute('src');

      expect(updatedSrc)
        .toBe(initialSrc);

    }).toPass({
      timeout: 5000
    });

    const finalSrc =
      await carouselImage.getAttribute('src');

    console.log(
      `After returning: ${finalSrc}`
    );

  }

);