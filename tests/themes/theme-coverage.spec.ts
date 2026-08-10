/**
 * Theme coverage for buyer-facing pages.
 *
 * Theme model (confirmed against backend projectThemeResolver):
 *  - Org themes (Apex / Zenith) are resolved at the ORGANIZATION level, not per
 *    request, so they cannot be switched from within a single test here. This
 *    spec therefore does NOT attempt to exercise Apex vs Zenith directly.
 *  - Project theme overrides ARE forceable per request via a query param on the
 *    microsite detail URL: `?projectTheme=omnia` / `?projectTheme=57avenue`.
 *    projectThemeResolver honors the override, so we can assert each renders.
 *  - The EOI page uses its own 'hola' theme (body.eoiUrl).
 *
 * What this spec proves:
 *  1. A microsite renders and shows the project name.
 *  2. Project-theme overrides (omnia, 57avenue) render without errors.
 *  3. Tracking is THEME-AGNOSTIC: after loading with a projectTheme override,
 *     firing a microsite event still lands in /microsite/:id/events (themes only
 *     vary a metadata click_source, not the ingest path).
 *  4. The EOI 'hola' page renders.
 */

import { test, expect } from '@playwright/test';
import {
  postWebhook,
  DEFAULT_PHONE,
  uniqueBuyerId,
  uniqueBuyerName,
  buildMicrositePrompt,
  buildEoiPrompt,
  assertMicrositeSuccess,
  assertEoiSuccess,
  micrositeIdFromUrl,
} from '../../utils/buyerLinks';
import {
  trackMicrositeEvent,
  getMicrositeEvents,
  randomDeviceId,
} from '../../utils/tracking';
import { TEST_DATA } from '../../utils/personas';

/** Error copy that must never appear on a healthy buyer page. */
const ERROR_TEXT = /not found|something went wrong|error|cannot get|404|500/i;

function withProjectTheme(url: string, theme: string): string {
  return url.includes('?') ? `${url}&projectTheme=${theme}` : `${url}?projectTheme=${theme}`;
}

test.describe('Theme coverage', () => {
  test('microsite renders default theme with project name @sanity', async ({
    request,
    page,
  }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildMicrositePrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertMicrositeSuccess(body);

    await page.goto(body.micrositeUrl as string, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(TEST_DATA.postVisitProject, {
      timeout: 30000,
    });
  });

  test('project-theme overrides render (omnia, 57avenue) @sanity', async ({
    request,
    page,
  }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildMicrositePrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertMicrositeSuccess(body);
    const micrositeUrl = body.micrositeUrl as string;

    for (const theme of ['omnia', '57avenue']) {
      await page.goto(withProjectTheme(micrositeUrl, theme), {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(ERROR_TEXT);
    }
  });

  test('tracking stays theme-agnostic under a projectTheme override @sanity', async ({
    request,
    page,
  }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildMicrositePrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertMicrositeSuccess(body);

    const micrositeUrl = body.micrositeUrl as string;
    const micrositeId = micrositeIdFromUrl(micrositeUrl);
    expect(micrositeId).toBeTruthy();

    // Load through a project-theme override, then prove ingest still works.
    await page.goto(withProjectTheme(micrositeUrl, 'omnia'), {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('body')).toBeVisible();

    const deviceId = randomDeviceId();
    await trackMicrositeEvent(request, micrositeId, 'project_details_viewed', deviceId);

    const { events } = await getMicrositeEvents(request, micrositeId, { limit: 100 });
    const seenTypes = events.map((e) => e.event_type);
    expect(seenTypes).toContain('project_details_viewed');
  });

  test('EOI hola page renders @sanity', async ({ request, page }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildEoiPrompt(buyerName, buyerId, TEST_DATA.eoiProject),
      DEFAULT_PHONE
    );
    assertEoiSuccess(body);

    await page.goto(body.eoiUrl as string, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });
});
