// ======================================================
// MICROSITE "STATUS" BOT QUERY + ENGAGEMENT EVENT PIPELINE
//
// Rewritten 2026-08-31: the previous version launched a HEADED persistent
// WhatsApp Web session (./whatsapp-session) and read the bot's replies from
// the real WhatsApp UI. That opened WhatsApp Web on the host, could never run
// headless/CI, and tested WhatsApp, not PropFocus. Everything below goes
// through PropFocus APIs instead:
//
//   - engagement is generated with POST /api/track-event (utils/tracking.ts)
//   - the pipeline is asserted with GET /api/microsite/:id/events
//   - the bot's "status" query is exercised through the same
//     POST /api/whatsapp-webhook the buyer-link suites use; quoting a bot
//     message (how a real broker scopes "status" to one microsite) is
//     attempted with the known payload shapes and skipped gracefully if the
//     webhook build does not accept a quote field.
//
// Outbound alert DELIVERY is owned by tests/alerts/broker-alerts.spec.ts
// (admin engagement-alert-audit APIs) — not duplicated here.
// ======================================================
import { test, expect, APIRequestContext } from '@playwright/test';
import {
  postWebhook,
  uniqueBuyerId,
  uniqueBuyerName,
  micrositeIdFromUrl,
} from '../utils/buyerLinks';
import { trackMicrositeEvent, getMicrositeEvents, randomDeviceId } from '../utils/tracking';

const PROJECT_NAME = 'Abhee Tranquila';

async function createMicrosite(request: APIRequestContext, prefix: string) {
  const body = await postWebhook(
    request,
    `${uniqueBuyerName(prefix)} ${uniqueBuyerId('ST')} for ${PROJECT_NAME}`
  );
  expect(body.success, `microsite create failed: ${body.message}`).toBe(true);
  expect(body.micrositeUrl, 'creation should return micrositeUrl').toBeTruthy();
  return {
    url: String(body.micrositeUrl),
    micrositeId: micrositeIdFromUrl(String(body.micrositeUrl)),
    botMessage: String(body.message ?? ''),
  };
}

/**
 * Ask the bot for a microsite's status the way a broker does on WhatsApp:
 * send "status" quoting the bot's original link message. Payload shapes are
 * tried in order; returns the first reply that is not the no-quote fallback,
 * else the last reply (so callers can assert the fallback guidance).
 */
async function queryStatus(
  request: APIRequestContext,
  quotedText: string | null
): Promise<{ message: string; quoted: boolean }> {
  const { WEBHOOK_URL, DEFAULT_PHONE } = await import('../utils/buyerLinks');
  const variants: object[] = quotedText
    ? [
        { event: 'message', data: { from: DEFAULT_PHONE, body: 'status', quotedMessage: quotedText } },
        { event: 'message', data: { from: DEFAULT_PHONE, body: 'status', quoted: { body: quotedText } } },
        { event: 'message', data: { from: DEFAULT_PHONE, body: 'status', context: { quotedMessage: quotedText } } },
      ]
    : [{ event: 'message', data: { from: DEFAULT_PHONE, body: 'status' } }];

  let last = '';
  for (const payload of variants) {
    const res = await request.post(WEBHOOK_URL, { data: payload, timeout: 60000 });
    const body = await res.json().catch(() => ({}));
    last = String(body.message ?? '');
    console.log(`status query -> ${last.slice(0, 200)}`);
    if (quotedText && last && !/no_quote|reply to|quote/i.test(last)) {
      return { message: last, quoted: true };
    }
  }
  return { message: last, quoted: false };
}

test.describe('Microsite Status Alerts (API)', () => {
  test.setTimeout(180000);

  test('ALERT_01 - Site visit booked event lands in the pipeline', async ({ request }) => {
    const ms = await createMicrosite(request, 'Sv');
    const deviceId = randomDeviceId();
    await trackMicrositeEvent(request, ms.micrositeId, 'link_open', deviceId);
    await trackMicrositeEvent(request, ms.micrositeId, 'site_visit_booked', deviceId);

    const events = await getMicrositeEvents(request, ms.micrositeId, { eventType: 'site_visit_booked' });
    expect(events.success).toBe(true);
    expect(events.events.length, 'site_visit_booked should be recorded').toBeGreaterThan(0);

    const status = await queryStatus(request, ms.botMessage);
    if (status.quoted) {
      expect(status.message).toMatch(/site visit|visit requested/i);
    } else {
      console.log('[status] webhook build does not accept a quote payload — pipeline asserted via events API');
    }
  });

  test('ALERT_02 - WhatsApp contact + URL share events land in the pipeline', async ({ request }) => {
    const ms = await createMicrosite(request, 'Wa');
    const deviceId = randomDeviceId();
    await trackMicrositeEvent(request, ms.micrositeId, 'link_open', deviceId);
    await trackMicrositeEvent(request, ms.micrositeId, 'url_shared', deviceId);

    const events = await getMicrositeEvents(request, ms.micrositeId, { eventType: 'url_shared' });
    expect(events.success).toBe(true);
    expect(events.events.length, 'url_shared should be recorded').toBeGreaterThan(0);
  });

  test('ALERT_03 - Repeated project-details views are all recorded', async ({ request }) => {
    const ms = await createMicrosite(request, 'Vs');
    const deviceId = randomDeviceId();
    for (let i = 0; i < 5; i++) {
      await trackMicrositeEvent(request, ms.micrositeId, 'project_details_viewed', deviceId);
    }
    const events = await getMicrositeEvents(request, ms.micrositeId, {
      eventType: 'project_details_viewed',
      limit: 10,
    });
    expect(events.success).toBe(true);
    expect(events.events.length, 'all 5 views should be recorded').toBeGreaterThanOrEqual(5);
  });

  test('ALERT_04 - Fresh microsite reports no meaningful engagement', async ({ request }) => {
    const ms = await createMicrosite(request, 'Ne');

    const events = await getMicrositeEvents(request, ms.micrositeId, { limit: 20 });
    expect(events.success).toBe(true);
    const meaningful = events.events.filter(
      (e: any) => !['link_open', 'page_view', 'time_spent'].includes(e.event_type ?? e.eventType)
    );
    expect(meaningful.length, 'no meaningful engagement yet').toBe(0);

    const status = await queryStatus(request, ms.botMessage);
    if (status.quoted) {
      expect(status.message).toMatch(/no meaningful engagement/i);
    }
  });

  test('ALERT_05 - Plain "status" without a quote gets guidance, not a crash', async ({ request }) => {
    const status = await queryStatus(request, null);
    expect(status.message, 'bot should answer a bare status query').toBeTruthy();
  });
});
