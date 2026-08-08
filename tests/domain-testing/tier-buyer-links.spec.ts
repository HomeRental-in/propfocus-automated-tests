/**
 * Tier-aware coverage for the NON-microsite buyer links: SITE VISIT, POST VISIT
 * and EOI. Microsite tier routing is already covered by tier1/tier-2/tier-3
 * spec files, so it is intentionally NOT duplicated here.
 *
 * All existing tier specs (tier1.spec.ts, tier-2.spec.ts, tier-3.spec.ts) and
 * domain-routing.spec.ts drive the same dev broker phone `9999999999` and only
 * differ by the public URL host/shape the org is currently configured for:
 *
 *   Tier 1 (SHARED_PATH)    -> dev.propfocus.in/propfocus-internal/{token}
 *   Tier 2 (ORG_SUBDOMAIN)  -> propfocus-internal.dev.propfocus.in/{token}
 *   Tier 3 (CUSTOM_DOMAIN)  -> discover.n8npropfocus.com/{token}
 *
 * Backend URL shapes for the other link types (from the tier builder):
 *   Tier 1 SHARED_PATH:   post-visit /pricing/{orgSlug}/{token}, eoi /eoi/{orgSlug}/{token}
 *   Tier 2 ORG_SUBDOMAIN: {orgSlug}.{apexHost}/pricing/{token},  .../eoi/{token}
 *   Tier 3 CUSTOM_DOMAIN: {customHost}/pricing/{token},          {customHost}/eoi/{token}
 *
 * These tests only assert on the webhook JSON response (URL shape + success),
 * they do NOT navigate to the generated links, so custom-domain DNS/SSL state
 * does not affect them.
 */

import { test, expect } from '@playwright/test';
import {
  postWebhook,
  uniqueBuyerId,
  uniqueBuyerName,
  buildSiteVisitPrompt,
  buildPostVisitPrompt,
  buildEoiPrompt,
  assertSiteVisitSuccess,
  assertPostVisitSuccess,
  assertEoiSuccess,
  extractLinkToken,
} from '../../utils/buyerLinks';
import { TEST_DATA } from '../../utils/personas';

interface TierConfig {
  /** Human label for the describe block. */
  label: string;
  /** Broker phone whose org is configured for this tier. */
  phone: string;
  /** Expected post-visit URL shape (host + `/pricing/`). */
  postVisitUrl: RegExp;
  /** Expected EOI URL shape (host + `/eoi/`). */
  eoiUrl: RegExp;
  /**
   * Reason to skip the whole tier block. When set, all tests in the block are
   * skipped with this note instead of running.
   */
  skipReason?: string;
}

const TIERS: TierConfig[] = [
  {
    label: 'Tier 1 (SHARED_PATH)',
    // Mirrors tier1.spec.ts (PHONE.ACTIVE).
    phone: '9999999999',
    // dev.propfocus.in/pricing/{orgSlug}/{token}
    postVisitUrl: /^https:\/\/dev\.propfocus\.in\/pricing\/propfocus-internal\/.+/,
    // dev.propfocus.in/eoi/{orgSlug}/{token}
    eoiUrl: /^https:\/\/dev\.propfocus\.in\/eoi\/propfocus-internal\/.+/,
  },
  {
    label: 'Tier 2 (ORG_SUBDOMAIN)',
    // Mirrors tier-2.spec.ts (PHONE.ACTIVE).
    phone: '9999999999',
    // {orgSlug}.dev.propfocus.in/pricing/{token}
    postVisitUrl: /^https:\/\/propfocus-internal\.dev\.propfocus\.in\/pricing\/.+/,
    // {orgSlug}.dev.propfocus.in/eoi/{token}
    eoiUrl: /^https:\/\/propfocus-internal\.dev\.propfocus\.in\/eoi\/.+/,
  },
  {
    label: 'Tier 3 (CUSTOM_DOMAIN)',
    // Mirrors tier-3.spec.ts / domain-routing.spec.ts (PHONE.ACTIVE + custom host).
    phone: '9999999999',
    // {customHost}/pricing/{token}
    postVisitUrl: /^https:\/\/discover\.n8npropfocus\.com\/pricing\/.+/,
    // {customHost}/eoi/{token}
    eoiUrl: /^https:\/\/discover\.n8npropfocus\.com\/eoi\/.+/,
    // NOTE: The existing tier-3 spec has a working custom host
    // (discover.n8npropfocus.com), so this block is NOT skipped. Custom-domain
    // DNS/SSL is a documented backend TODO, but it is irrelevant here because
    // these tests only assert the webhook-returned URL shape and never navigate.
    // If the custom host is ever removed from the tier specs, set skipReason
    // below to re-instate the documented skip.
    // skipReason: 'Tier 3 custom host not configured (DNS/SSL is a backend TODO).',
  },
];

for (const tier of TIERS) {
  test.describe(`${tier.label} - Buyer Links`, () => {
    test.skip(!!tier.skipReason, tier.skipReason ?? '');

    test(
      `${tier.label} - Post-Visit link matches tier URL shape @sanity`,
      async ({ request }) => {
        const buyerName = uniqueBuyerName();
        const buyerId = uniqueBuyerId();

        const body = await postWebhook(
          request,
          buildPostVisitPrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
          tier.phone
        );

        assertPostVisitSuccess(body);

        console.log(`Post-Visit URL: ${body.postVisitUrl}`);
        expect(body.postVisitUrl).toContain('/pricing/');
        expect(body.postVisitUrl!).toMatch(tier.postVisitUrl);
      }
    );

    test(
      `${tier.label} - EOI link matches tier URL shape @sanity`,
      async ({ request }) => {
        const buyerName = uniqueBuyerName();
        const buyerId = uniqueBuyerId();

        const body = await postWebhook(
          request,
          buildEoiPrompt(buyerName, buyerId, TEST_DATA.eoiProject),
          tier.phone
        );

        assertEoiSuccess(body);

        console.log(`EOI URL: ${body.eoiUrl}`);
        expect(body.eoiUrl).toContain('/eoi/');
        expect(body.eoiUrl!).toMatch(tier.eoiUrl);
      }
    );

    test(
      `${tier.label} - Site Visit link created @sanity`,
      async ({ request }) => {
        const buyerName = uniqueBuyerName();
        const buyerId = uniqueBuyerId();

        const body = await postWebhook(
          request,
          buildSiteVisitPrompt(buyerName, buyerId, TEST_DATA.postVisitProject),
          tier.phone
        );

        // The webhook returns only a link_token for site visits (no full public
        // URL), so we assert the token is present and do NOT assert a URL shape.
        assertSiteVisitSuccess(body);

        const token = extractLinkToken(body);
        console.log(`Site Visit link_token: ${token}`);
        expect(token).toBeTruthy();
      }
    );
  });
}
