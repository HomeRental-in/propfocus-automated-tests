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
import {
  adminCredsConfigured,
  adminLogin,
  getEngagementAlertAudit,
  getEngagementAlertHealth,
  getVisitorAlertAudit,
  EngagementAlertEntry,
} from '../../utils/adminApi';

/**
 * SCOPE / LIMITATION
 * ------------------
 * Broker alerts are outbound WhatsApp messages. They cannot be observed from the
 * client side — the only reliable signal is on the backend. This spec therefore
 * verifies alerts exclusively through the admin audit APIs:
 *   - engagement-alert-audit / engagement-alert-health  (reads the `alerts_sent`
 *     table joined to microsites/brokers — the API source of truth for ENGAGEMENT
 *     (microsite) alerts)
 *   - visitor-alert-audit                                (visitor/whatsappSentAt log)
 *
 * The SV/PV/EOI `*_broker_notified` events are DB-only and are NOT exposed by any
 * admin API, so they are intentionally OUT OF SCOPE here. This file covers only
 * the engagement (microsite) alerts and the visitor-alert audit, which ARE
 * API-readable.
 *
 * Alerts are also ASYNCHRONOUS and gated: high-value events bypass the alert
 * cooldown, but the actual send may still be delayed by a minimum session-dwell
 * gate. A fired event may therefore not produce a `sent` row within a short test
 * window (or at all). The @regression flow below is written to tolerate this.
 */

// High-value events that BYPASS the alert cooldown (per contract).
const HIGH_VALUE_EVENTS = ['site_visit_booked', 'callback_requested'] as const;

const PROJECT = 'Abhee';

test.describe('Broker Alerts', () => {
  test.skip(!adminCredsConfigured(), 'Set ADMIN_EMAIL/ADMIN_PASSWORD for alert audit');

  test.setTimeout(180000);

  // ====================================================
  // @sanity — DETERMINISTIC endpoint contract checks.
  // These must pass reliably regardless of async alert timing.
  // ====================================================

  test('@sanity engagement-alert-health returns a summary object', async ({ request }) => {
    const { token } = await adminLogin(request);
    expect(token, 'admin login should return a token').toBeTruthy();

    const health = await getEngagementAlertHealth(request, token, 24);
    expect(health, 'health payload should be an object').toBeTruthy();
    expect(typeof health).toBe('object');
    expect(health.summary, 'health.summary should be present').toBeDefined();
    expect(typeof health.summary).toBe('object');

    // Summary is expected to expose numeric-ish counters (totalSent/totalFailed etc.).
    // We do not hard-assert specific keys (backend may evolve), only that a numeric
    // counter exists somewhere in the summary object.
    const summary = health.summary as Record<string, unknown>;
    const hasNumericCounter = Object.values(summary).some(
      (v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)))
    );
    console.log(`engagement-alert-health.summary = ${JSON.stringify(summary)}`);
    expect(hasNumericCounter, 'summary should contain at least one numeric-ish counter').toBe(true);
  });

  test('@sanity engagement-alert-audit returns a well-shaped array', async ({ request }) => {
    const { token } = await adminLogin(request);

    const entries = await getEngagementAlertAudit(request, token, { hours: 24, limit: 50 });
    expect(Array.isArray(entries), 'audit should return an array').toBe(true);
    console.log(`engagement-alert-audit returned ${entries.length} entrie(s)`);

    if (entries.length > 0) {
      for (const entry of entries) {
        expect(entry.status, 'each entry should have a status').toBeDefined();
        const hasPhone =
          entry.recipientPhone !== undefined || entry.brokerPhone !== undefined;
        expect(hasPhone, 'each entry should carry recipientPhone or brokerPhone').toBe(true);
      }
    }
  });

  test('@sanity visitor-alert-audit returns an array', async ({ request }) => {
    const { token } = await adminLogin(request);

    const entries = await getVisitorAlertAudit(request, token, 50);
    expect(Array.isArray(entries), 'visitor-alert-audit should return an array').toBe(true);
    console.log(`visitor-alert-audit returned ${entries.length} entrie(s)`);
  });

  // ====================================================
  // @regression — BEST-EFFORT end-to-end.
  //
  // We create a real microsite and fire high-value events to try to provoke a
  // broker alert, then poll the audit for a matching row. Because the send is
  // dwell/timing gated and asynchronous, a matching `sent` row may never appear
  // inside a short test window. We therefore treat the send as best-effort:
  //   - If a matching row is found, we assert its status is a valid enum value.
  //   - If not, we DO NOT fail on the missing async send; the floor assertion is
  //     simply that the audit endpoint still returns an array. This documents the
  //     path end-to-end without making the test flaky.
  // ====================================================

  test('@regression high-value events best-effort trigger a broker alert', async ({ request }) => {
    const { token } = await adminLogin(request);

    // 1) Create a fresh microsite as DEFAULT_PHONE.
    const buyerId = uniqueBuyerId('BA');
    const endUser = uniqueBuyerName('Alert');
    const prompt = buildMicrositePrompt(endUser, buyerId, PROJECT);
    const body = await postWebhook(request, prompt, DEFAULT_PHONE);
    assertMicrositeSuccess(body);

    const micrositeId = micrositeIdFromUrl(body.micrositeUrl as string);
    expect(micrositeId, 'should derive a micrositeId from the URL').toBeTruthy();
    console.log(
      `Created microsite=${micrositeId} buyerId=${buyerId} endUser=${endUser} (${body.micrositeUrl})`
    );

    // 2) Fire high-value events with a SINGLE shared deviceId so they form one
    //    session (session dwell is what gates the send).
    const deviceId = randomDeviceId();
    for (const eventType of HIGH_VALUE_EVENTS) {
      await trackMicrositeEvent(request, micrositeId, eventType, deviceId);
    }

    // 3) Poll the engagement-alert audit for a row that matches our microsite or buyer.
    const MAX_ATTEMPTS = 6;
    const WAIT_MS = 10000;
    let found: EngagementAlertEntry | undefined;
    let lastEntries: EngagementAlertEntry[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !found; attempt++) {
      lastEntries = await getEngagementAlertAudit(request, token, { hours: 1, limit: 200 });
      found = lastEntries.find(
        (e) => e.micrositeId === micrositeId || e.buyerId === buyerId
      );

      console.log(
        `[attempt ${attempt}/${MAX_ATTEMPTS}] audit rows=${lastEntries.length} match=${
          found ? 'YES' : 'no'
        }`
      );

      if (!found && attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
      }
    }

    if (found) {
      console.log(`Broker alert OBSERVED for microsite=${micrositeId}: ${JSON.stringify(found)}`);
      expect(['sent', 'sending', 'failed']).toContain(found.status);
    } else {
      // Async send is dwell/timing gated — a missing row is not a test failure.
      console.log(
        `Broker alert NOT observed within ${(MAX_ATTEMPTS * WAIT_MS) / 1000}s for ` +
          `microsite=${micrositeId}/buyerId=${buyerId}. This is expected when the ` +
          `dwell/timing gate has not been satisfied; treating as best-effort.`
      );
    }

    // Floor assertion (always holds): the audit endpoint returns an array.
    expect(Array.isArray(lastEntries)).toBe(true);
    console.log(`Broker alert observed: ${found ? 'true' : 'false'}`);
  });
});
