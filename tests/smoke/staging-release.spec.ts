/**
 * Staging release smoke (@release) — the Sept 2026 codebase-audit release.
 *
 * Targets the risky parts of that release that unit tests cannot prove:
 *   1. Deploy wiring   — every JS/CSS chunk the new code-split build references
 *                        is actually served; fonts no longer render-block.
 *   2. Event tracking  — /track-event now answers before its side effects and
 *                        serialises them per microsite; a burst must stay fast
 *                        and lose nothing.
 *   3. Buyer pages     — mobile render of all four link types, no dashboard /
 *                        admin / xlsx / charts code on a buyer link, friendly
 *                        error screen on bad links, CTA failures show an error
 *                        (never a fake "Callback Requested!").
 *   4. Dashboard       — overview, All Leads search + keyboard row expand,
 *                        Excel export (xlsx is now lazy-loaded), lazy help
 *                        articles, re-skinned API Keys / WhatsApp Blast.
 *   5. Query fixes     — event counts on multi-project links are no longer
 *                        multiplied by the number of projects; Client 360 still
 *                        answers.
 *
 * Run against staging (links are created with TEST_PHONE's broker):
 *   BASE_URL=https://<staging-host> API_URL=https://<staging-host>/api/whatsapp-webhook \
 *     npx playwright test tests/smoke/staging-release.spec.ts --project=chromium --no-deps
 *
 * Tunables: RELEASE_TRACK_MAX_MS (default 5000), RELEASE_BUYER_JS_BUDGET_KB (default 600).
 */
import { test, expect, devices, Page, APIRequestContext, ConsoleMessage, Request } from '@playwright/test';
import {
  API_BASE,
  DEFAULT_PHONE,
  postWebhook,
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
  micrositeIdFromUrl,
  WebhookBody,
} from '../../utils/buyerLinks';
import { getMicrositeEvents, randomDeviceId } from '../../utils/tracking';
import { loginBroker, findLeadOnDashboard } from '../../utils/dashboardApi';
import { dismissOnboardingTour } from '../../utils/uiLogin';
import { TEST_DATA } from '../../utils/personas';
import { getMultiProjectTestNames } from '../../utils/micrositeProjects';

const BASE_URL = (process.env.BASE_URL ?? 'https://dev.propfocus.in').replace(/\/+$/, '');
const TRACK_MAX_MS = Number(process.env.RELEASE_TRACK_MAX_MS ?? 5000);
const BUYER_JS_BUDGET_KB = Number(process.env.RELEASE_BUYER_JS_BUDGET_KB ?? 600);

/** Chunks that must never load on a buyer link after the bundle split. */
const DASHBOARD_ONLY_CHUNK = /\/assets\/(xlsx|charts|recharts|PropFocusDashboard|HelpArticle|AdminApp|admin|dashboard)[-.][^/]*\.js/i;
/** Browser noise from third-party tags that says nothing about our build. */
const THIRD_PARTY_NOISE = /facebook|fbevents|google|gtag|doubleclick|clarity|sentry|favicon|hotjar|ERR_BLOCKED_BY_CLIENT/i;
/** Console errors that mean a broken deploy (missing chunk / chunk init order). */
const FATAL_CONSOLE = /dynamically imported module|Loading chunk|ChunkLoadError|before initialization|is not a function|Unexpected token '<'/i;

// ======================================================
// Helpers
// ======================================================

interface PageHealth {
  pageErrors: string[];
  fatalConsole: string[];
  assetRequests: string[];
  /** Detach only the listeners this watcher added. */
  stop: () => void;
}

/** Records uncaught errors, fatal console errors and /assets/ requests for a page. */
function watchPage(page: Page): PageHealth {
  const onPageError = (err: Error) => {
    if (!THIRD_PARTY_NOISE.test(String(err?.stack ?? err))) health.pageErrors.push(String(err));
  };
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error' && FATAL_CONSOLE.test(msg.text()) && !THIRD_PARTY_NOISE.test(msg.text())) {
      health.fatalConsole.push(msg.text());
    }
  };
  const onRequest = (req: Request) => {
    if (req.url().includes('/assets/')) health.assetRequests.push(req.url());
  };
  const health: PageHealth = {
    pageErrors: [],
    fatalConsole: [],
    assetRequests: [],
    stop: () => {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('request', onRequest);
    },
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('request', onRequest);
  return health;
}

function expectHealthy(health: PageHealth, label: string): void {
  expect(health.pageErrors, `${label}: uncaught page errors`).toEqual([]);
  expect(health.fatalConsole, `${label}: chunk / init errors in console`).toEqual([]);
}

/** Same-origin JS transferred so far (KB). */
async function jsTransferKb(page: Page): Promise<number> {
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e: any) => e.initiatorType === 'script' || /\.js(\?|$)/.test(e.name))
      .reduce((sum, e: any) => sum + (e.transferSize || e.encodedBodySize || 0), 0)
  );
  return Math.round(bytes / 1024);
}

/** Every /assets/*.js|css referenced by an HTML shell must be served (catches a half-deployed build). */
async function expectShellAssetsServed(request: APIRequestContext, url: string): Promise<number> {
  const res = await request.get(url);
  expect(res.status(), `${url} should render`).toBe(200);
  const html = await res.text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))];
  expect(assets.length, `${url} should reference built assets`).toBeGreaterThan(0);
  for (const asset of assets) {
    const a = await request.get(`${BASE_URL}${asset}`);
    expect(a.status(), `asset ${asset} (from ${url}) must be served`).toBe(200);
  }
  return assets.length;
}

async function createMicrosite(request: APIRequestContext, projects: string, prefix = 'Rel'): Promise<{
  body: WebhookBody;
  buyerName: string;
  buyerId: string;
  micrositeId: string;
}> {
  const buyerName = uniqueBuyerName(prefix);
  const buyerId = uniqueBuyerId('R');
  const body = await postWebhook(request, buildMicrositePrompt(buyerName, buyerId, projects), DEFAULT_PHONE);
  assertMicrositeSuccess(body);
  return { body, buyerName, buyerId, micrositeId: micrositeIdFromUrl(String(body.micrositeUrl)) };
}

async function timedTrackEvent(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ status: number; ms: number }> {
  const started = Date.now();
  const res = await request.post(`${API_BASE}/track-event`, { data, timeout: 60_000 });
  return { status: res.status(), ms: Date.now() - started };
}

/** Log the dashboard in by API (no OTP send) and seed the SPA's token before first paint. */
async function openDashboard(page: Page, request: APIRequestContext, path = '/dashboard'): Promise<void> {
  const session = await loginBroker(request, DEFAULT_PHONE);
  await page.addInitScript((token) => {
    window.localStorage.setItem('token', token);
  }, session.token);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await dismissOnboardingTour(page);
}

// ======================================================
// 1. Deploy wiring
// ======================================================

test.describe('Release: deploy wiring @release @smoke', () => {
  test('REL_01 - every chunk referenced by the dashboard and buyer shells is served', async ({ request }) => {
    const { body } = await createMicrosite(request, TEST_DATA.postVisitProject);
    const dashCount = await expectShellAssetsServed(request, `${BASE_URL}/dashboard/login`);
    const buyerCount = await expectShellAssetsServed(request, String(body.micrositeUrl));
    console.log(`[release] shell assets OK: dashboard=${dashCount}, buyer=${buyerCount}`);
  });

  test('REL_02 - Google Fonts are not render-blocking on buyer pages', async ({ request }) => {
    const { body } = await createMicrosite(request, TEST_DATA.postVisitProject);
    const html = await (await request.get(String(body.micrositeUrl))).text();
    const outsideNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
    const blocking = outsideNoscript.match(/<link[^>]+rel="stylesheet"[^>]+fonts\.googleapis\.com[^>]*>/gi) ?? [];
    expect(blocking, 'fonts stylesheet should be preload+onload, not a blocking <link rel=stylesheet>').toEqual([]);
  });
});

// ======================================================
// 2. Event tracking (track-event rewrite)
// ======================================================

test.describe('Release: event tracking @release @smoke', () => {
  test('REL_03 - track-event stays fast under a burst and records every event', async ({ request }) => {
    const { micrositeId } = await createMicrosite(request, TEST_DATA.postVisitProject);
    const deviceId = randomDeviceId();
    const fp = `fp-release-${Date.now()}`;
    const session = `sess-release-${Date.now()}`;
    const base = { micrositeId, deviceId, fp_hash: fp, session_id: session };

    const { events: before } = await getMicrositeEvents(request, micrositeId, { limit: 500 });

    // A realistic buyer journey, one beacon at a time…
    const journey = ['link_open', 'page_view', 'project_details_viewed', 'floorplan_checked', 'download_brochure'];
    const sequential: { status: number; ms: number }[] = [];
    for (const eventType of journey) sequential.push(await timedTrackEvent(request, { ...base, eventType }));

    // …then 20 beacons at once (the pattern that used to drain the DB pool).
    const burst = await Promise.all(
      Array.from({ length: 20 }, () => timedTrackEvent(request, { ...base, eventType: 'page_view' }))
    );

    const all = [...sequential, ...burst];
    const slowest = Math.max(...all.map((r) => r.ms));
    console.log(`[release] track-event: sequential max ${Math.max(...sequential.map((r) => r.ms))}ms, burst max ${Math.max(...burst.map((r) => r.ms))}ms`);
    expect(all.filter((r) => r.status !== 200), 'every track-event must answer 200').toEqual([]);
    expect(slowest, `slowest track-event must be under ${TRACK_MAX_MS}ms`).toBeLessThan(TRACK_MAX_MS);

    // Side effects are deferred now — give them a moment, then read back.
    await expect
      .poll(async () => (await getMicrositeEvents(request, micrositeId, { limit: 500 })).events.length, {
        timeout: 30_000,
        message: 'all fired events should be persisted',
      })
      .toBeGreaterThanOrEqual(before.length + all.length);

    const { events } = await getMicrositeEvents(request, micrositeId, { limit: 500 });
    const autoShares = events.filter((e: any) => e.event_type === 'url_shared' && e.fp_hash === fp).length;
    if (autoShares > 1) console.warn(`[release] ${autoShares} auto url_shared events for one fingerprint (expected <= 1)`);
  });
});

// ======================================================
// 3. Buyer pages (mobile)
// ======================================================

test.describe('Release: buyer pages on mobile @release @smoke', () => {
  // iPhone viewport/UA/touch on Chromium (the device's default WebKit engine can't be switched per group).
  const { defaultBrowserType: _engine, ...iPhone } = devices['iPhone 13'];
  test.use(iPhone);

  test('REL_04 - microsite renders without dashboard code and within the JS budget', async ({ page, request }) => {
    const { body } = await createMicrosite(request, TEST_DATA.postVisitProject);
    const health = watchPage(page);

    await page.goto(String(body.micrositeUrl), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('button', { name: /try again/i }), 'microsite should not show the error screen').toHaveCount(0);

    expectHealthy(health, 'microsite');
    const leaked = health.assetRequests.filter((u) => DASHBOARD_ONLY_CHUNK.test(u));
    expect(leaked, 'buyer link must not download dashboard/admin/xlsx/charts chunks').toEqual([]);

    const kb = await jsTransferKb(page);
    console.log(`[release] buyer microsite JS transferred: ${kb} KB`);
    expect(kb, `buyer JS should stay under ${BUYER_JS_BUDGET_KB} KB`).toBeLessThan(BUYER_JS_BUDGET_KB);
  });

  test('REL_05 - site visit, post visit and EOI pages render', async ({ page, request }) => {
    const project = TEST_DATA.postVisitProject;

    const sv = await postWebhook(request, buildSiteVisitPrompt(uniqueBuyerName('RelSv'), uniqueBuyerId('S'), project));
    assertSiteVisitSuccess(sv);
    const pv = await postWebhook(request, buildPostVisitPrompt(uniqueBuyerName('RelPv'), uniqueBuyerId('P'), project));
    assertPostVisitSuccess(pv);
    const eoi = await postWebhook(request, buildEoiPrompt(uniqueBuyerName('RelEoi'), uniqueBuyerId('E'), TEST_DATA.eoiProject));
    assertEoiSuccess(eoi);

    const pages: [string, string][] = [
      ['site visit', `${BASE_URL}/sv/${sv.link_token}`],
      ['post visit', String(pv.postVisitUrl)],
      ['eoi', String(eoi.eoiUrl)],
    ];
    for (const [label, url] of pages) {
      const health = watchPage(page);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.getByRole('button', { name: /try again/i }), `${label} should not show the error screen`).toHaveCount(0);
      expectHealthy(health, label);
      const leaked = health.assetRequests.filter((u) => DASHBOARD_ONLY_CHUNK.test(u));
      expect(leaked, `${label} must not download dashboard chunks`).toEqual([]);
      health.stop();
    }
  });

  test('REL_06 - bad buyer links show the friendly error screen with Try again', async ({ page }) => {
    for (const path of ['/sv/release-smoke-missing', '/pricing/release-smoke-missing', '/eoi/release-smoke-missing']) {
      const health = watchPage(page);
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /try again/i }), `${path} should offer Try again`).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator('body'), `${path} must not show raw error text`).not.toContainText(/Network Error|Request failed with status code/i);
      expectHealthy(health, path);
      health.stop();
    }
  });

  test('REL_07 - a failed callback request shows an error, never a fake success', async ({ page, request }) => {
    const { body } = await createMicrosite(request, TEST_DATA.postVisitProject);

    // Force the lead-capture endpoints to fail the way a flaky 4G connection would.
    let intercepted = 0;
    await page.route(/\/api\/(request-callback|price-reveal|book-site-visit)/, (route) => {
      intercepted += 1;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' });
    });

    await page.goto(String(body.micrositeUrl), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const callback = page.getByRole('button', { name: /call ?back/i }).first();
    test.skip(!(await callback.isVisible().catch(() => false)), 'this theme has no visible callback button on first screen');

    await callback.click();
    await expect.poll(() => intercepted, { message: 'callback click should hit the API' }).toBeGreaterThan(0);
    await expect(page.getByText(/callback requested|request submitted/i), 'no fake success on failure').toHaveCount(0);
    await expect(page.getByText(/try again|tap to retry|couldn.t|could not|went wrong/i).first(), 'an error should be shown').toBeVisible({
      timeout: 15_000,
    });
  });
});

// ======================================================
// 4. Query fixes (API)
// ======================================================

test.describe('Release: dashboard query fixes @release @smoke', () => {
  test('REL_08 - multi-project link counts each event once and Client 360 answers', async ({ request }) => {
    const multi = getMultiProjectTestNames();
    test.skip(multi.length < 2, 'needs two multi-project-capable test projects');

    const { buyerName, micrositeId } = await createMicrosite(request, `${multi[0]} and ${multi[1]}`, 'RelMulti');
    const deviceId = randomDeviceId();
    for (const eventType of ['link_open', 'download_brochure']) {
      const r = await timedTrackEvent(request, { micrositeId, eventType, deviceId });
      expect(r.status).toBe(200);
    }

    const session = await loginBroker(request, DEFAULT_PHONE);
    await expect
      .poll(async () => (await findLeadOnDashboard(request, session.token, { buyerName }))?.stats?.brochureDownloads ?? -1, {
        timeout: 30_000,
        message: 'lead should appear on the dashboard with its brochure download',
      })
      .toBeGreaterThanOrEqual(1);

    const row = await findLeadOnDashboard(request, session.token, { buyerName });
    const { events } = await getMicrositeEvents(request, micrositeId, { limit: 500 });
    const brochures = events.filter((e: any) => e.event_type === 'download_brochure').length;
    console.log(`[release] ${row.projectNames?.length} projects; dashboard totalEvents=${row.stats.totalEvents} vs events=${events.length}`);
    expect(row.projectNames?.length ?? 0, 'link should carry two projects').toBeGreaterThanOrEqual(2);
    expect(row.stats.brochureDownloads, 'brochure downloads must not be multiplied by project count').toBe(brochures);
    // Upper bound rather than equality: the dashboard may filter by date or broker devices,
    // but a count above the raw event total means it was multiplied per project again.
    expect(row.stats.totalEvents, 'total events must not be multiplied by project count').toBeLessThanOrEqual(events.length);

    const client = await request.get(`${API_BASE}/dashboard/client/${row.id}`, {
      headers: { Authorization: `Bearer ${session.token}` },
      timeout: 45_000,
    });
    expect(client.status(), 'Client 360 should answer').toBe(200);
    expect((await client.json()).success).toBe(true);
  });
});

// ======================================================
// 5. Dashboard UI
// ======================================================

test.describe('Release: dashboard UI @release @smoke', () => {
  test('REL_09 - overview loads in every date range without errors', async ({ page, request }) => {
    const health = watchPage(page);
    await openDashboard(page, request);
    await expect(page.getByText(/pipeline funnel/i)).toBeVisible({ timeout: 30_000 });
    for (const range of ['Today', '7D', '30D', 'All']) {
      await page.getByRole('button', { name: range, exact: true }).first().click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.getByText(/pipeline funnel/i)).toBeVisible();
    }
    expectHealthy(health, 'overview');
  });

  test('REL_10 - All Leads search, keyboard row expand and Excel export', async ({ page, request }) => {
    const { buyerName } = await createMicrosite(request, TEST_DATA.postVisitProject, 'RelLead');
    const health = watchPage(page);
    await openDashboard(page, request, '/dashboard?tab=leads');

    const search = page.getByPlaceholder(/search buyers/i);
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill(buyerName);
    await expect(page.getByText(buyerName).first(), 'search should find the fresh lead').toBeVisible({ timeout: 30_000 });

    // New a11y: expandable rows are focusable and open on Enter.
    const row = page.locator('[aria-expanded]').filter({ hasText: buyerName }).first();
    if (await row.count()) {
      await row.focus();
      await page.keyboard.press('Enter');
      await expect(row).toHaveAttribute('aria-expanded', 'true');
    } else {
      console.warn('[release] no aria-expanded row for the lead (mobile list layout?) — skipped keyboard check');
    }

    // xlsx is lazy-loaded on click now; a small filtered export downloads directly.
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /^export$/i }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename(), 'export should be an Excel file').toMatch(/\.xlsx$/i);
    await expect(page.getByText(/export failed/i)).toHaveCount(0);
    expectHealthy(health, 'all leads');
  });

  test('REL_11 - help articles, API Keys and WhatsApp Blast render', async ({ page, request }) => {
    const health = watchPage(page);
    await openDashboard(page, request, '/dashboard/help?article=wa-microsite');
    await expect(page.getByRole('heading', { name: /microsite link using whatsapp/i })).toBeVisible({ timeout: 30_000 });

    await page.goto(`${BASE_URL}/dashboard/settings/api-keys`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/api keys/i).first()).toBeVisible({ timeout: 30_000 });

    await page.goto(`${BASE_URL}/dashboard/settings/whatsapp-blast`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/blast|campaign/i).first()).toBeVisible({ timeout: 30_000 });

    expectHealthy(health, 'help / settings');
  });
});
