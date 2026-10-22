/**
 * Curation (multi-project) page: tracking + theme coverage.
 *
 * Closes the "curation page tracking both themes" gap: curation-testing.spec.ts
 * only proves the page renders; nothing proved that tracking ingests on a
 * curation microsite, or that the page renders (and still tracks) under the
 * forceable project-theme overrides (omnia, 57avenue) that theme-coverage.spec.ts
 * exercises for single-project microsites.
 *
 * Verification contract (same as single-project microsites):
 *  - Curation pages are microsite records, so POST /track-event +
 *    GET /microsite/:id/events is the read-back path; the id is the last URL
 *    segment of the /propfocus-internal/ URL.
 *  - Org themes (Apex / Zenith) resolve at the organization level and cannot be
 *    switched per request; `?projectTheme=omnia|57avenue` can, so those are the
 *    two themes exercised here.
 */

import { test, expect, APIRequestContext } from '@playwright/test';
import {
  postWebhook,
  DEFAULT_PHONE,
  uniqueBuyerId,
  uniqueBuyerName,
  buildCurationPrompt,
  assertMicrositeSuccess,
  micrositeIdFromUrl,
  WebhookBody,
} from '../../utils/buyerLinks';
import {
  trackMicrositeEvent,
  getMicrositeEvents,
  randomDeviceId,
} from '../../utils/tracking';

/** Error copy that must never appear on a healthy buyer page. */
const ERROR_TEXT = /not found|something went wrong|error|cannot get|404|500/i;

/**
 * Project trio that resolves unambiguously as one curation on dev. 'Unnati'
 * (the old TC_MS_24/25 trio member) now matches two projects and triggers a
 * clarification request, so it must not appear here.
 */
const CURATION_PROJECTS = (
  process.env.CURATION_PROJECTS ?? 'Abhee Aaria,Sampada,Abhee Tranquila'
)
  .split(',')
  .map((p) => p.trim());

const PROJECT_THEMES = ['omnia', '57avenue'] as const;

function withProjectTheme(url: string, theme: string): string {
  return url.includes('?') ? `${url}&projectTheme=${theme}` : `${url}?projectTheme=${theme}`;
}

/**
 * The webhook's NLP parse is non-deterministic: the same project trio sometimes
 * resolves to a curation and sometimes answers "Sent clarification request -
 * ambiguous project". Retry a few times before failing so that known dev-env
 * wobble does not fail theme/tracking assertions that are not about parsing.
 */
async function createCuration(
  request: APIRequestContext
): Promise<{ url: string; micrositeId: string }> {
  let body: WebhookBody = {};
  for (let attempt = 1; attempt <= 3; attempt++) {
    body = await postWebhook(
      request,
      buildCurationPrompt(uniqueBuyerName(), uniqueBuyerId(), CURATION_PROJECTS),
      DEFAULT_PHONE
    );
    if (body.micrositeUrl) break;
    console.warn(
      `Curation attempt ${attempt} returned no micrositeUrl (${body.message}); retrying`
    );
  }
  assertMicrositeSuccess(body);
  const url = body.micrositeUrl as string;
  // Curation URLs moved from /propfocus-internal/ to /<org-slug>/<token>;
  // accept either shape and key everything off the trailing microsite id.
  expect(url).toMatch(/^https?:\/\/.+\/[^/]+\/[^/]+/);
  const micrositeId = micrositeIdFromUrl(url);
  expect(micrositeId).toBeTruthy();
  return { url, micrositeId };
}

test.describe('Curation page tracking + themes', () => {
  let curationUrl = '';
  let micrositeId = '';

  test.beforeAll(async ({ request }) => {
    ({ url: curationUrl, micrositeId } = await createCuration(request));
    console.log(`Curation URL: ${curationUrl} (id: ${micrositeId})`);
  });

  test('curation: fired events read back via /microsite/:id/events @sanity', async ({
    request,
  }) => {
    // Same device across all fires so they belong to one visitor session.
    const deviceId = randomDeviceId();
    const firedTypes = ['link_open', 'project_details_viewed', 'gallery_viewed'];
    for (const eventType of firedTypes) {
      await trackMicrositeEvent(request, micrositeId, eventType, deviceId);
    }

    const { events } = await getMicrositeEvents(request, micrositeId, { limit: 100 });
    const seenTypes = events.map((e) => e.event_type);
    for (const eventType of firedTypes) {
      expect(seenTypes).toContain(eventType);
    }
  });

  for (const theme of PROJECT_THEMES) {
    test(`curation: ${theme} theme renders cards and still tracks @sanity`, async ({
      request,
      page,
    }) => {
      await page.goto(withProjectTheme(curationUrl, theme), {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toContainText(ERROR_TEXT);

      // Multi-project layout survives the theme override.
      const projectCards = page.locator('text=View Details');
      await expect(projectCards.first()).toBeVisible({ timeout: 15000 });
      expect(await projectCards.count()).toBeGreaterThanOrEqual(CURATION_PROJECTS.length);

      // Tracking is theme-agnostic: ingest still lands after a themed load.
      const eventType = 'project_details_viewed';
      await trackMicrositeEvent(request, micrositeId, eventType, randomDeviceId());
      const { events } = await getMicrositeEvents(request, micrositeId, {
        eventType,
        limit: 100,
      });
      expect(events.map((e) => e.event_type)).toContain(eventType);
    });
  }

  test('curation: page_view fires from a real browser load @regression', async ({
    request,
    page,
  }) => {
    // Fresh curation so prior API-fired events cannot mask the browser's own.
    const fresh = await createCuration(request);

    await page.goto(fresh.url, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // The client tracker flushes asynchronously (~5-8s on dev), so poll.
    let seenTypes: string[] = [];
    await expect
      .poll(
        async () => {
          const { events } = await getMicrositeEvents(request, fresh.micrositeId, {
            limit: 100,
          });
          seenTypes = events.map((e) => e.event_type);
          return seenTypes.length;
        },
        { timeout: 20000, intervals: [2000] }
      )
      .toBeGreaterThan(0);
    console.log(`Events after browser load: ${JSON.stringify(seenTypes)}`);
    // Real page load leaves page_view / link_open footprints.
    expect(seenTypes.some((t) => t === 'page_view' || t === 'link_open')).toBe(true);
  });
});
