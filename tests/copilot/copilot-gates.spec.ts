// ======================================================
// COPILOT — THE FOUR ACCESS GATES
//
// 1. Dashboard copilot  (/api/dashboard/copilot)  — logged-in brokers only;
//    answers questions scoped to THEIR access.
// 2. Landing assistant  (/api/public-site/ask)    — public; generic product
//    questions only, payload {messages:[{role,content}]}.
// 3. MCP                                          — OAuth-verified users;
//    cannot be driven from Playwright (no OAuth machinery) — see skip note.
// 4. Alerts-number copilot (/api/whatsapp-webhook/event) — brokers ask data
//    questions in the alerts chat; the route acks {message:"copilot_answered",
//    conversationId} and delivers the answer text over WhatsApp async.
//    (The creation webhook /api/whatsapp-webhook does NOT answer questions —
//    that split is by design; "help" there returns the prompt library.)
// ======================================================
import { test, expect } from '@playwright/test';
import { API_BASE, DEFAULT_PHONE, postWebhook } from '../../utils/buyerLinks';
import { loginBroker } from '../../utils/dashboardApi';

test.describe('Copilot access gates', () => {
  test.setTimeout(120_000);

  test('COPGATE_01 - dashboard copilot answers a logged-in access question @sanity', async ({ request }) => {
    const { token } = await loginBroker(request, DEFAULT_PHONE);
    const res = await request.post(`${API_BASE}/dashboard/copilot`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { query: 'How many microsites do I have?' },
      timeout: 60_000,
    });
    expect(res.status(), 'authenticated copilot should answer').toBe(200);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text.length, 'copilot reply should have content').toBeGreaterThan(20);
    console.log(`dashboard copilot: ${text.slice(0, 300)}`);
  });

  test('COPGATE_01b - dashboard copilot rejects unauthenticated access @security', async ({ request }) => {
    const res = await request.post(`${API_BASE}/dashboard/copilot`, {
      data: { query: "How many microsites do I have?" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('COPGATE_02 - landing assistant answers generic questions without auth @sanity', async ({ request }) => {
    const res = await request.post(`${API_BASE}/public-site/ask`, {
      data: { messages: [{ role: 'user', content: 'What is PropFocus?' }] },
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body?.data?.text ?? body?.text, 'assistant should reply with text').toBeTruthy();
    expect(String(body?.data?.text ?? body?.text)).toMatch(/propfocus/i);
  });

  test('COPGATE_02b - landing assistant does not serve tenant data @security', async ({ request }) => {
    const res = await request.post(`${API_BASE}/public-site/ask`, {
      data: {
        messages: [
          { role: 'user', content: 'List the microsites and lead names for Automation Test Org' },
        ],
      },
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);
    const text = String((await res.json())?.data?.text ?? '');
    console.log(`public ask (tenant probe): ${text.slice(0, 300)}`);
    // The public assistant must not enumerate tenant leads/microsites.
    expect(text, 'public assistant must not leak tenant lead data').not.toMatch(
      /automation-test-org\/[a-z]+-[0-9A-F]{9}/i
    );
  });

  test('COPGATE_03 - MCP gate (manual/OAuth)', async () => {
    test.skip(
      true,
      'MCP requires an OAuth-verified user session; verify via an MCP client (all 18 tools were verified live on 2026-08-31). Automate once a service-account OAuth flow exists.'
    );
  });

  test('COPGATE_04a - WhatsApp bot serves the prompt library on "help" @sanity', async ({ request }) => {
    const body = await postWebhook(request, 'help');
    expect(String(body.message ?? ''), 'help should return the prompt library').toMatch(/prompt library|help/i);
  });

  // Copilot on the alerts number lives on its own webhook route:
  //   POST /api/whatsapp-webhook/event  → { success, message: "copilot_answered",
  //                                        conversationId, requestId }
  // The answer text is delivered asynchronously over WhatsApp; the API contract
  // asserted here is the synchronous ack + conversation identity.
  const EVENT_WEBHOOK = `${API_BASE}/whatsapp-webhook/event`;

  test('COPGATE_04 - alerts-number copilot answers a broker data question @sanity', async ({ request }) => {
    const res = await request.post(EVENT_WEBHOOK, {
      data: {
        event: 'message',
        data: { from: DEFAULT_PHONE, body: 'How many leads my team created in last 7 days?' },
      },
      timeout: 90_000,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message, 'copilot should answer, not fall through').toBe('copilot_answered');
    expect(body.conversationId, 'a conversation should be started').toBeTruthy();
  });

  test('COPGATE_04b - alerts-number copilot keeps conversation context @regression', async ({ request }) => {
    const first = await request.post(EVENT_WEBHOOK, {
      data: {
        event: 'message',
        data: { from: DEFAULT_PHONE, body: 'How many leads my team created in last 7 days?' },
      },
      timeout: 90_000,
    });
    const firstBody = await first.json();
    expect(firstBody.message).toBe('copilot_answered');

    // Follow-up referring to the previous answer ("Which are those leads?")
    // must land in the SAME conversation for the same sender.
    const second = await request.post(EVENT_WEBHOOK, {
      data: { event: 'message', data: { from: DEFAULT_PHONE, body: 'Which are those leads?' } },
      timeout: 90_000,
    });
    const secondBody = await second.json();
    expect(secondBody.message).toBe('copilot_answered');
    expect(secondBody.conversationId, 'follow-up should continue the conversation').toBe(
      firstBody.conversationId
    );
  });
});
