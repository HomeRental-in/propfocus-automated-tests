/**
 * Pre-prod deployment health gate (@smoke).
 *
 * Fast, environment-relative wiring checks that catch the class of issue a
 * deployment (or an integration change like the Salesforce OAuth incident)
 * introduces: dead routes, auth gates accidentally removed, tracking config
 * unset, SEO/noindex flipped, or the WhatsApp webhook not responding.
 *
 * Everything here is read-only except one microsite creation through the
 * webhook (the same call the rest of the suite makes hundreds of times).
 * Runs against BASE_URL (default DEV) — point BASE_URL/API_URL at staging to
 * gate a staging build.
 */
import { test, expect } from '@playwright/test';
import {
  API_BASE,
  DEFAULT_PHONE,
  postWebhook,
  uniqueBuyerId,
  uniqueBuyerName,
} from '../../utils/buyerLinks';

const BASE_URL = process.env.BASE_URL ?? 'https://dev.propfocus.in';

test.describe('Pre-prod health gate', () => {
  test('HEALTH_01 - marketing shell and dashboard login page respond @smoke @sanity', async ({ request }) => {
    const home = await request.get(`${BASE_URL}/`);
    expect(home.status(), 'marketing shell should be up').toBe(200);

    const login = await request.get(`${BASE_URL}/dashboard/login`);
    expect(login.status(), 'dashboard login should be up').toBe(200);
  });

  test('HEALTH_02 - WhatsApp webhook is alive @smoke @sanity', async ({ request }) => {
    // A greeting never creates a link, so this is side-effect free.
    const body = await postWebhook(request, 'hello');
    expect(body, 'webhook should return JSON').toBeTruthy();
  });

  test('HEALTH_03 - tracking config is wired @smoke', async ({ request }) => {
    const res = await request.get(`${API_BASE}/tracking/config`);
    expect(res.status(), 'tracking config endpoint should exist').toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const cfg = json.data ?? {};
    // Soft checks: dev/staging may intentionally leave ad ids empty, so log
    // loudly instead of failing the gate on config-only differences.
    if (!cfg.metaPixelId) console.warn('[health] metaPixelId is not set');
    if (!cfg.ga4MeasurementId) console.warn('[health] ga4MeasurementId is not set');
    if (!cfg.googleAdsConversionId)
      console.warn('[health] googleAdsConversionId is null — Google Ads conversions will not report');
  });

  test('HEALTH_04 - buyer link creates end-to-end and stays noindex @smoke @sanity', async ({ request }) => {
    const name = uniqueBuyerName('Health');
    const body = await postWebhook(request, `${name} ${uniqueBuyerId('H')} for Abhee Tranquila`);
    expect(body.success, `webhook should create a microsite: ${body.message}`).toBe(true);
    expect(body.micrositeUrl, 'response should include micrositeUrl').toBeTruthy();

    const page = await request.get(String(body.micrositeUrl));
    expect(page.status(), 'generated buyer link should render').toBe(200);
    const html = await page.text();
    expect(html, 'buyer pages must not be indexable').toContain('noindex');
  });

  test('HEALTH_05 - sensitive API groups reject unauthenticated access @smoke @security', async ({ request }) => {
    for (const path of [
      '/followup/brokers',
      '/admin/eoi-campaigns',
      '/daily-report/brokers',
      '/dashboard/overview-stats',
      '/dashboard/copilot/suggestions',
    ]) {
      const res = await request.get(`${API_BASE}${path}`);
      expect([401, 403], `${path} must be auth-gated, got ${res.status()}`).toContain(res.status());
    }

    // /api/sf/:id must never serve Salesforce lead data without auth.
    const sf = await request.get(`${API_BASE}/sf/HEALTHCHECK000`);
    expect(sf.status(), '/api/sf/:id must not answer 200 unauthenticated').not.toBe(200);
  });

  test('HEALTH_06 - robots.txt and sitemap respond @smoke', async ({ request }) => {
    const robots = await request.get(`${BASE_URL}/robots.txt`);
    expect(robots.status()).toBe(200);

    const sitemap = await request.get(`${BASE_URL}/sitemap.xml`);
    expect(sitemap.status(), 'sitemap should be served').toBe(200);
  });
});
