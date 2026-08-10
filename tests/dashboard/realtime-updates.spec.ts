/**
 * Dashboard "real-time" update coverage.
 *
 * IMPORTANT — what "real time" means here:
 *   The dashboard is NOT websocket / push driven. Fresh data surfaces because
 *   the frontend re-fetches the REST endpoints on an interval, and the backend
 *   itself caches some responses. So "real time" in this suite = the data
 *   becomes visible within a short POLLING window (~60s), not instantly.
 *
 * Two contract facts drive this test:
 *   1. GET /dashboard/recent-activity is cached server-side for ~60s, has a
 *      7-day lookback, and EXCLUDES the 'page_view' and 'time_spent' event
 *      types. To beat the cache between polls we vary a query param (`limit`)
 *      on every attempt so each request is a distinct cache key.
 *   2. GET /dashboard/microsites reflects a newly-created microsite within the
 *      same refresh window, so its total count should climb after we create one.
 *
 * The whole flow runs as one broker (DEFAULT_PHONE): create a microsite via the
 * WhatsApp webhook, fire a non-excluded tracked event on it, then poll the two
 * dashboard endpoints until the new data appears.
 */

import { test, expect } from '@playwright/test';
import {
  postWebhook,
  DEFAULT_PHONE,
  uniqueBuyerId,
  uniqueBuyerName,
  buildMicrositePrompt,
  assertMicrositeSuccess,
  micrositeIdFromUrl,
} from '../../utils/buyerLinks';
import { trackMicrositeEvent, randomDeviceId } from '../../utils/tracking';
import { loginBroker, getMicrosites, getRecentActivity } from '../../utils/dashboardApi';
import { TEST_DATA } from '../../utils/personas';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('Dashboard real-time (polling) updates', () => {
  // These flows create a microsite + fire events + poll a cached endpoint, so
  // give the whole spec generous headroom (well beyond the ~90s poll budget).
  test.setTimeout(240_000);

  test('new microsite + tracked event surface within the ~60s polling window @sanity', async ({
    request,
  }) => {
    // ---- Login as the default broker ----
    const { token } = await loginBroker(request, DEFAULT_PHONE);
    expect(token).toBeTruthy();

    // ---- Baseline microsites total BEFORE we create anything ----
    const baseline = await getMicrosites(request, token);
    expect(baseline.status, `microsites baseline failed: ${JSON.stringify(baseline.body)}`).toBe(
      200
    );
    const baselineTotal: number = baseline.body?.data?.pagination?.total ?? 0;
    console.log(`Baseline microsites total: ${baselineTotal}`);

    // ---- Create a fresh microsite as DEFAULT_PHONE ----
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();
    const webhook = await postWebhook(
      request,
      buildMicrositePrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertMicrositeSuccess(webhook);

    const micrositeId = micrositeIdFromUrl(webhook.micrositeUrl as string);
    expect(micrositeId, 'could not derive micrositeId from micrositeUrl').toBeTruthy();
    console.log(`Created microsite ${micrositeId} for buyer ${buyerName} (${buyerId})`);

    // ---- Fire a NON-excluded tracked event (page_view / time_spent are hidden) ----
    const deviceId = randomDeviceId();
    await trackMicrositeEvent(request, micrositeId, 'project_details_viewed', deviceId);

    // ---- Poll recent-activity until our event shows up ----
    // Cache-bust by varying `limit` each attempt (30, 31, 32, ...).
    // ~8 attempts x ~10s waits keeps the max wait around ~90s.
    const MAX_ATTEMPTS = 8;
    const POLL_INTERVAL_MS = 10_000;
    let matched = false;
    let lastActivityCount = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !matched; attempt++) {
      const limit = 30 + attempt; // distinct cache key per poll
      const res = await getRecentActivity(request, token, { limit });
      expect(
        res.status,
        `recent-activity poll #${attempt + 1} failed: ${JSON.stringify(res.body)}`
      ).toBe(200);

      const activity: any[] = res.body?.data?.activity ?? [];
      lastActivityCount = activity.length;

      matched = activity.some(
        (entry) => entry?.buyerId === buyerId || entry?.micrositeId === micrositeId
      );

      console.log(
        `recent-activity poll #${attempt + 1} (limit=${limit}): ${activity.length} entries, matched=${matched}`
      );

      if (!matched && attempt < MAX_ATTEMPTS - 1) {
        await sleep(POLL_INTERVAL_MS);
      }
    }

    expect(
      matched,
      `recent-activity never surfaced our event for buyerId=${buyerId} / micrositeId=${micrositeId} ` +
        `after ${MAX_ATTEMPTS} polls (last activity length=${lastActivityCount}). ` +
        `Note: endpoint is ~60s cached and excludes page_view/time_spent — this asserts ` +
        `near-real-time (polling) visibility, not push.`
    ).toBe(true);
  });

  test('microsites total increases after creating a microsite (polling refresh) @sanity', async ({
    request,
  }) => {
    // ---- Login as the default broker ----
    const { token } = await loginBroker(request, DEFAULT_PHONE);
    expect(token).toBeTruthy();

    // ---- Baseline total ----
    const baseline = await getMicrosites(request, token);
    expect(baseline.status, `microsites baseline failed: ${JSON.stringify(baseline.body)}`).toBe(
      200
    );
    const baselineTotal: number = baseline.body?.data?.pagination?.total ?? 0;
    console.log(`Baseline microsites total: ${baselineTotal}`);

    // ---- Create a fresh microsite ----
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();
    const webhook = await postWebhook(
      request,
      buildMicrositePrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
      DEFAULT_PHONE
    );
    assertMicrositeSuccess(webhook);
    console.log(`Created microsite for buyer ${buyerName} (${buyerId})`);

    // ---- Poll the microsites total until it climbs above baseline ----
    const MAX_ATTEMPTS = 8;
    const POLL_INTERVAL_MS = 10_000;
    let increased = false;
    let lastTotal = baselineTotal;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !increased; attempt++) {
      const res = await getMicrosites(request, token, { limit: 20 + attempt });
      expect(
        res.status,
        `microsites poll #${attempt + 1} failed: ${JSON.stringify(res.body)}`
      ).toBe(200);

      lastTotal = res.body?.data?.pagination?.total ?? lastTotal;
      increased = lastTotal > baselineTotal;

      console.log(
        `microsites poll #${attempt + 1}: total=${lastTotal} (baseline=${baselineTotal}), increased=${increased}`
      );

      if (!increased && attempt < MAX_ATTEMPTS - 1) {
        await sleep(POLL_INTERVAL_MS);
      }
    }

    expect(
      increased,
      `microsites total did not increase above baseline (${baselineTotal}) after ${MAX_ATTEMPTS} polls ` +
        `(last total=${lastTotal}). This asserts near-real-time (polling) reflection of a new microsite.`
    ).toBe(true);
  });
});
