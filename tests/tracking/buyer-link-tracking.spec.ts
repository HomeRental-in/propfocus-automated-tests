/**
 * Buyer-link tracking coverage across all FOUR link types.
 *
 * Verification contract (confirmed against backend helpers):
 *  - Microsite has a public read-back: POST /track-event then
 *    GET /microsite/:id/events returns the events, so we assert the fired
 *    event_type appears in getMicrositeEvents().events.
 *  - Site visit / Post visit / EOI have NO public event-list endpoint. We
 *    verify by asserting trackXActivity(...) returns { recorded: true } and
 *    getX(...) returns HTTP 200 with data.
 *
 * Fresh buyer id/name per create so dedupe/reuse never returns an old link.
 */

import { test, expect } from '@playwright/test';
import {
  postWebhook,
  DEFAULT_PHONE,
  uniqueBuyerId,
  uniqueBuyerName,
  buildMicrositePrompt,
  buildSiteVisitPrompt,
  buildPostVisitPrompt,
  buildEoiPrompt,
  assertMicrositeSuccess,
  assertSiteVisitSuccess,
  assertPostVisitSuccess,
  assertEoiSuccess,
  extractLinkToken,
  micrositeIdFromUrl,
} from '../../utils/buyerLinks';
import {
  trackMicrositeEvent,
  getMicrositeEvents,
  trackSiteVisitActivity,
  trackPostVisitActivity,
  trackEoiActivity,
  getSiteVisit,
  getPostVisit,
  getEoi,
  randomDeviceId,
  SV_ACTIVITY_TYPES,
  PVP_ACTIVITY_TYPES,
  EOIP_ACTIVITY_TYPES,
} from '../../utils/tracking';
import { TEST_DATA } from '../../utils/personas';

test.describe('Buyer link tracking', () => {
  test('microsite: fired events read back via /microsite/:id/events @sanity', async ({
    request,
  }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildMicrositePrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertMicrositeSuccess(body);

    const micrositeId = micrositeIdFromUrl(body.micrositeUrl as string);
    expect(micrositeId).toBeTruthy();

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

  test('site visit: activities record and page reads back @sanity', async ({ request }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildSiteVisitPrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertSiteVisitSuccess(body);

    const token = extractLinkToken(body);
    expect(token).toBeTruthy();

    const page = await getSiteVisit(request, token as string);
    expect(page.status).toBe(200);
    expect(page.data).toBeTruthy();

    for (const activityType of SV_ACTIVITY_TYPES.slice(0, 3)) {
      const result = await trackSiteVisitActivity(request, token as string, activityType);
      expect(result.recorded).toBe(true);
    }
  });

  test('post visit: activities record and page reads back @sanity', async ({ request }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildPostVisitPrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertPostVisitSuccess(body);

    const token = extractLinkToken(body);
    expect(token).toBeTruthy();

    const page = await getPostVisit(request, token as string);
    expect(page.status).toBe(200);
    expect(page.data).toBeTruthy();

    for (const activityType of PVP_ACTIVITY_TYPES.slice(0, 3)) {
      const result = await trackPostVisitActivity(request, token as string, activityType);
      expect(result.recorded).toBe(true);
    }
  });

  test('EOI: activities record and page reads back @sanity', async ({ request }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildEoiPrompt(buyerName, buyerId, TEST_DATA.eoiProject),
      DEFAULT_PHONE
    );
    assertEoiSuccess(body);

    const token = extractLinkToken(body);
    expect(token).toBeTruthy();

    const page = await getEoi(request, token as string);
    expect(page.status).toBe(200);
    expect(page.data).toBeTruthy();

    for (const activityType of EOIP_ACTIVITY_TYPES.slice(0, 3)) {
      const result = await trackEoiActivity(request, token as string, activityType);
      expect(result.recorded).toBe(true);
    }
  });

  test('unsupported site-visit activity type is rejected @regression', async ({ request }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildSiteVisitPrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertSiteVisitSuccess(body);

    const token = extractLinkToken(body);
    expect(token).toBeTruthy();

    const result = await trackSiteVisitActivity(
      request,
      token as string,
      'not_a_real_activity'
    );
    expect(result.recorded).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test('invalid link token to post-visit returns 404 @regression', async ({ request }) => {
    const page = await getPostVisit(request, 'definitely-not-a-real-token-000');
    expect(page.status).toBe(404);
  });
});
