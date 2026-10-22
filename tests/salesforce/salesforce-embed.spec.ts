// ======================================================
// SALESFORCE EMBED / SHORT-LINK SURFACE
//
// What is reachable from outside the Salesforce org:
//   GET /embed/salesforce/:id  -> iframe shell embedded in SF lead/opportunity
//                                 pages; the app then resolves /api/sf/:id
//   GET /api/sf/:id            -> short-URL resolver used by SF-triggered
//                                 links; unknown ids must 404 cleanly
//
// The OAuth handshake and lead/opportunity sync jobs live server-side and
// need an admin/SF session — verify those from the admin panel after any
// OAuth change (see the Amberstone incident). This spec pins the customer-
// facing wiring so a deploy cannot silently break the iframe.
// ======================================================
import { test, expect } from '@playwright/test';
import { API_BASE } from '../../utils/buyerLinks';

const BASE_URL = process.env.BASE_URL ?? 'https://dev.propfocus.in';

test.describe('Salesforce embed surface', () => {
  test('SF_01 - embed shell responds for the SF iframe @sanity', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/embed/salesforce/SFHEALTHCHECK01`);
    expect(res.status(), 'embed shell must load inside the SF iframe').toBe(200);
    const html = await res.text();
    expect(html, 'embed route should serve the app shell').toContain('<div id="root"');
  });

  test('SF_02 - short-link resolver 404s cleanly on unknown ids @regression', async ({ request }) => {
    const res = await request.get(`${API_BASE}/sf/SFHEALTHCHECK01`);
    expect(res.status(), 'unknown sf short link should 404, not 5xx').toBe(404);
    const body = await res.json().catch(() => ({}));
    expect(body.success).toBe(false);
  });

  test('SF_03 - embed pages are excluded from crawling @regression', async ({ request }) => {
    const robots = await request.get(`${BASE_URL}/robots.txt`);
    expect(robots.status()).toBe(200);
    const text = await robots.text();
    // Either a blanket disallow or an explicit /embed/ disallow keeps SF iframe
    // content out of search results.
    expect(
      /Disallow:\s*\/\s*$/m.test(text) || text.includes('Disallow: /embed'),
      'robots.txt should keep /embed/ out of crawlers'
    ).toBe(true);
  });
});
