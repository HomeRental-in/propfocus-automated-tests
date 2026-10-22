// ======================================================
// WHATSAPP BLAST (Marketing → blast manager)
//
// Routes (discovered from the dashboard bundle, confirmed on dev):
//   GET  /api/whatsapp-blast/sample-csv               (public CSV template)
//   GET  /api/whatsapp-blast/connection               (auth) WA connection status
//   GET  /api/whatsapp-blast/jobs/active              (auth) running blast job
//   GET  /api/whatsapp-blast/bulk-links/jobs/active   (auth) running bulk-link job
//   GET  /api/whatsapp-blast/bulk-links/jobs/recent   (auth) recent bulk-link jobs
//   POST /api/whatsapp-blast/send                     (auth) OUTBOUND — never called
//
// SAFETY: send/parse endpoints that lead to real WhatsApp messages are only
// asserted for auth-gating; this spec never launches a blast.
// ======================================================
import { test, expect } from '@playwright/test';
import { API_BASE, DEFAULT_PHONE } from '../../utils/buyerLinks';
import { loginBroker } from '../../utils/dashboardApi';

const BLAST_BASE = `${API_BASE}/whatsapp-blast`;

test.describe('WhatsApp blast — read paths & gating', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    ({ token } = await loginBroker(request, DEFAULT_PHONE));
  });

  const auth = () => ({ headers: { Authorization: `Bearer ${token}` } });

  test('BLAST_01 - sample CSV template downloads with expected columns @sanity', async ({ request }) => {
    const res = await request.get(`${BLAST_BASE}/sample-csv`);
    expect(res.status()).toBe(200);
    const csv = await res.text();
    for (const col of ['name', 'mobile', 'buyer_id', 'lead_type', 'rep_number']) {
      expect(csv.split('\n')[0], `sample CSV should include ${col}`).toContain(col);
    }
  });

  // Blast is feature-gated: org owners or brokers granted access by PropFocus.
  // The automation roster has no grant, so a clean 403 with the permission
  // message proves the route is wired AND the gate works; 200 covers granted
  // brokers when the grant exists (e.g. after setting BLAST-enabled TEST_PHONE).
  async function expectBlastRoute(res: import('@playwright/test').APIResponse, path: string) {
    expect([200, 403], `${path} should be wired (200 granted / 403 gated)`).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    if (res.status() === 403) {
      expect(String(body.error), `${path} 403 should be the permission gate`).toContain(
        'only available to organization owners'
      );
    } else {
      expect(body, `${path} payload should be JSON`).toBeTruthy();
    }
  }

  test('BLAST_02 - connection status route is wired and permission-gated @sanity', async ({ request }) => {
    const res = await request.get(`${BLAST_BASE}/connection`, auth());
    await expectBlastRoute(res, '/connection');
  });

  test('BLAST_03 - job endpoints are wired and permission-gated @regression', async ({ request }) => {
    for (const path of ['/jobs/active', '/bulk-links/jobs/active', '/bulk-links/jobs/recent']) {
      const res = await request.get(`${BLAST_BASE}${path}`, auth());
      await expectBlastRoute(res, path);
    }
  });

  test('BLAST_04 - blast surface is auth-gated @security', async ({ request }) => {
    for (const path of ['/connection', '/jobs/active', '/bulk-links/jobs/active', '/bulk-links/jobs/recent']) {
      const res = await request.get(`${BLAST_BASE}${path}`);
      expect(res.status(), `${path} must reject unauthenticated access`).toBe(401);
    }
    // Outbound send must never be callable without auth (and is never called with it here).
    const send = await request.post(`${BLAST_BASE}/send`, { data: {} });
    expect([401, 403], 'send must be auth-gated').toContain(send.status());
  });
});
