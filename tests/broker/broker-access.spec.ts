import { test, expect } from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';
import {
  assertMicrositeAllowed,
  assertMicrositeBlocked,
  assertSiteVisitAllowed,
  assertSiteVisitBlocked,
  bookSiteVisitForBroker,
  ensureMicrositeForBroker,
  sendBrokerWebhook,
  uniqueBuyerId,
} from '../../utils/brokerAccessHelpers';
import { uniqueBuyerName } from '../../utils/buyerLinks';
import { loginBroker, findLeadOnDashboard } from '../../utils/dashboardApi';
import {
  getDefaultTestProject,
  getSuccessTestProjects,
} from '../../utils/micrositeProjects';
import { SITE_VISIT_DEFAULT_SLOT } from '../../utils/siteVisitProjects';

// ======================================================
// BROKER ACCESS
//
// Role coverage (main / sub / inactive / suspended) — NOT the full project
// catalog. Every success project is already asserted in
// microsite-nlp-formats + site-visit-nlp-formats. Repeating that matrix here
// × 4 brokers was ~1,400 webhook messages with no extra product signal.
//
// Extra links we DO create are checked on the dashboard (lead appears).
// ======================================================

const DEFAULT_PROJECT = getDefaultTestProject().name;
const EXTRA_PROJECT =
  getSuccessTestProjects().find((p) => p.name === 'KNS Sampada')?.name ??
  DEFAULT_PROJECT;
const ROLE_PROJECTS = Array.from(new Set([DEFAULT_PROJECT, EXTRA_PROJECT]));
const DEFAULT_ALIASES = getDefaultTestProject().aliases ?? [];

const SV_PROMPT_BUILDERS: Array<{
  name: string;
  build: (buyerName: string, buyerId: string, project: string) => string;
}> = [
  {
    name: 'for sv',
    build: (n, id, p) => `${n} ${id} for sv ${p} ${SITE_VISIT_DEFAULT_SLOT}`,
  },
  {
    name: 'for site visit',
    build: (n, id, p) =>
      `${n} ${id} for site visit ${p} ${SITE_VISIT_DEFAULT_SLOT}`,
  },
  {
    name: 'site visit for',
    build: (n, id, p) =>
      `${n} ${id} site visit for ${p} on tomorrow 11 AM`,
  },
  {
    name: 'Please book site visit',
    build: (n, id, p) =>
      `Please book site visit for ${n} ${id} at ${p} on tomorrow 11 AM`,
  },
  {
    name: 'tomorrow only no time',
    build: (n, id, p) => `${n} ${id} for sv ${p} on tomorrow`,
  },
  {
    name: 'coming Saturday',
    build: (n, id, p) =>
      `${n} ${id} for sv ${p} on coming Saturday 11 AM`,
  },
  {
    name: 'coming Sunday',
    build: (n, id, p) =>
      `${n} ${id} for sv ${p} on coming Sunday 11 AM`,
  },
  {
    name: 'next Saturday',
    build: (n, id, p) =>
      `${n} ${id} for sv ${p} on next Saturday 3 PM`,
  },
  {
    name: 'day after tomorrow',
    build: (n, id, p) =>
      `${n} ${id} for sv ${p} on day after tomorrow 11 AM`,
  },
  {
    name: 'tomorrow 2 PM',
    build: (n, id, p) => `${n} ${id} for sv ${p} on tomorrow 2 PM`,
  },
];

const CROSS_BROKER_CASES = [
  {
    name: 'Main microsite then Sub books SV',
    micrositePhone: BROKER_PHONE.MAIN_BROKER,
    svPhone: BROKER_PHONE.SUB_BROKER,
    expectSvAllowed: true,
  },
  {
    name: 'Sub microsite then Main books SV',
    micrositePhone: BROKER_PHONE.SUB_BROKER,
    svPhone: BROKER_PHONE.MAIN_BROKER,
    expectSvAllowed: true,
  },
  {
    name: 'Main microsite then Inactive blocked for SV',
    micrositePhone: BROKER_PHONE.MAIN_BROKER,
    svPhone: BROKER_PHONE.INACTIVE,
    expectSvAllowed: false,
  },
  {
    name: 'Sub microsite then Suspended blocked for SV',
    micrositePhone: BROKER_PHONE.SUB_BROKER,
    svPhone: BROKER_PHONE.SUSPENDED,
    expectSvAllowed: false,
  },
] as const;

async function assertLeadVisible(
  request: Parameters<typeof loginBroker>[0],
  phone: string,
  buyerName: string,
  buyerId: string
) {
  const { token } = await loginBroker(request, phone);
  let lead: unknown;
  for (let attempt = 0; attempt < 5 && !lead; attempt++) {
    lead = await findLeadOnDashboard(request, token, { buyerName, buyerId });
    if (!lead && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  expect(
    lead,
    `Dashboard did not show lead ${buyerName} / ${buyerId} for ${phone}`
  ).toBeTruthy();
  console.log(`Dashboard lead visible for ${phone}: ${buyerName} ${buyerId} ✓`);
}

// ======================================================
// 1. ROLE COVERAGE — default + one extra project, not the full catalog
// ======================================================

test.describe('Broker access — microsite by role', () => {
  for (const project of ROLE_PROJECTS) {
    test(`BRK_MS_MAIN - ${project} @regression`, async ({ request }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      const body = await sendBrokerWebhook(
        request,
        `${buyerName} ${buyerId} for ${project}`,
        BROKER_PHONE.MAIN_BROKER
      );
      assertMicrositeAllowed(body);
      await assertLeadVisible(request, BROKER_PHONE.MAIN_BROKER, buyerName, buyerId);
    });

    test(`BRK_MS_SUB - ${project} @regression`, async ({ request }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      const body = await sendBrokerWebhook(
        request,
        `${buyerName} ${buyerId} for ${project}`,
        BROKER_PHONE.SUB_BROKER
      );
      assertMicrositeAllowed(body);
      await assertLeadVisible(request, BROKER_PHONE.SUB_BROKER, buyerName, buyerId);
    });

    test(`BRK_MS_INACTIVE - ${project} blocked @regression`, async ({ request }) => {
      const buyerId = uniqueBuyerId();
      const body = await sendBrokerWebhook(
        request,
        `Harsha ${buyerId} for ${project}`,
        BROKER_PHONE.INACTIVE
      );
      assertMicrositeBlocked(body);
    });

    test(`BRK_MS_SUSPENDED - ${project} blocked @regression`, async ({ request }) => {
      const buyerId = uniqueBuyerId();
      const body = await sendBrokerWebhook(
        request,
        `Harsha ${buyerId} for ${project}`,
        BROKER_PHONE.SUSPENDED
      );
      assertMicrositeBlocked(body);
    });
  }
});

test.describe('Broker access — site visit by role', () => {
  for (const project of ROLE_PROJECTS) {
    const svPrompt = (buyerName: string, buyerId: string) =>
      `${buyerName} ${buyerId} for sv ${project} ${SITE_VISIT_DEFAULT_SLOT}`;

    test(`BRK_SV_MAIN - ${project} @regression`, async ({ request }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      await ensureMicrositeForBroker(
        request,
        BROKER_PHONE.MAIN_BROKER,
        buyerName,
        buyerId,
        project
      );
      const body = await bookSiteVisitForBroker(
        request,
        BROKER_PHONE.MAIN_BROKER,
        svPrompt(buyerName, buyerId)
      );
      assertSiteVisitAllowed(body);
    });

    test(`BRK_SV_SUB - ${project} @regression`, async ({ request }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      await ensureMicrositeForBroker(
        request,
        BROKER_PHONE.SUB_BROKER,
        buyerName,
        buyerId,
        project
      );
      const body = await bookSiteVisitForBroker(
        request,
        BROKER_PHONE.SUB_BROKER,
        svPrompt(buyerName, buyerId)
      );
      assertSiteVisitAllowed(body);
    });

    test(`BRK_SV_INACTIVE - ${project} blocked @regression`, async ({ request }) => {
      const buyerId = uniqueBuyerId();
      const body = await bookSiteVisitForBroker(
        request,
        BROKER_PHONE.INACTIVE,
        svPrompt('Harsha', buyerId)
      );
      assertSiteVisitBlocked(body);
    });

    test(`BRK_SV_SUSPENDED - ${project} blocked @regression`, async ({ request }) => {
      const buyerId = uniqueBuyerId();
      const body = await bookSiteVisitForBroker(
        request,
        BROKER_PHONE.SUSPENDED,
        svPrompt('Harsha', buyerId)
      );
      assertSiteVisitBlocked(body);
    });
  }
});

// ======================================================
// 2. PROJECT ALIASES — default project only, MAIN & SUB
// ======================================================

test.describe('Broker access — site visit via project aliases', () => {
  for (const alias of DEFAULT_ALIASES) {
    test(`BRK_SV_ALIAS_MAIN - "${alias}" → ${DEFAULT_PROJECT} @regression`, async ({
      request,
    }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      await ensureMicrositeForBroker(
        request,
        BROKER_PHONE.MAIN_BROKER,
        buyerName,
        buyerId,
        DEFAULT_PROJECT
      );
      const body = await bookSiteVisitForBroker(
        request,
        BROKER_PHONE.MAIN_BROKER,
        `${buyerName} ${buyerId} for sv ${alias} ${SITE_VISIT_DEFAULT_SLOT}`
      );
      assertSiteVisitAllowed(body);
    });

    test(`BRK_SV_ALIAS_SUB - "${alias}" → ${DEFAULT_PROJECT} @regression`, async ({
      request,
    }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      await ensureMicrositeForBroker(
        request,
        BROKER_PHONE.SUB_BROKER,
        buyerName,
        buyerId,
        DEFAULT_PROJECT
      );
      const body = await bookSiteVisitForBroker(
        request,
        BROKER_PHONE.SUB_BROKER,
        `${buyerName} ${buyerId} for sv ${alias} ${SITE_VISIT_DEFAULT_SLOT}`
      );
      assertSiteVisitAllowed(body);
    });
  }
});

// ======================================================
// 3. CROSS-BROKER SITE VISIT
// ======================================================

test.describe('Broker access — cross-broker site visit', () => {
  for (const testCase of CROSS_BROKER_CASES) {
    test(`BRK_X_SV - ${testCase.name} @regression`, async ({ request }) => {
      const buyerName = uniqueBuyerName();
      const buyerId = uniqueBuyerId();
      await ensureMicrositeForBroker(
        request,
        testCase.micrositePhone,
        buyerName,
        buyerId,
        DEFAULT_PROJECT
      );

      const body = await bookSiteVisitForBroker(
        request,
        testCase.svPhone,
        `${buyerName} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
      );

      if (testCase.expectSvAllowed) {
        assertSiteVisitAllowed(body);
      } else {
        assertSiteVisitBlocked(body);
      }
    });
  }
});

// ======================================================
// 4. INACTIVE / SUSPENDED cannot create microsite then SV
// ======================================================

test.describe('Broker access — blocked brokers cannot chain microsite + SV', () => {
  test('BRK_CHAIN_INACTIVE - microsite blocked @regression', async ({ request }) => {
    const buyerId = uniqueBuyerId();
    const ms = await sendBrokerWebhook(
      request,
      `Harsha ${buyerId} for ${DEFAULT_PROJECT}`,
      BROKER_PHONE.INACTIVE
    );
    assertMicrositeBlocked(ms);

    const sv = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.INACTIVE,
      `Harsha ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitBlocked(sv);
  });

  test('BRK_CHAIN_SUSPENDED - microsite should be blocked @regression', async ({
    request,
  }) => {
    const buyerId = uniqueBuyerId();
    const ms = await sendBrokerWebhook(
      request,
      `Harsha ${buyerId} for ${DEFAULT_PROJECT}`,
      BROKER_PHONE.SUSPENDED
    );
    assertMicrositeBlocked(ms);

    const sv = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.SUSPENDED,
      `Harsha ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitBlocked(sv);
  });
});

// ======================================================
// 5. SV NLP + DATE PHRASES — MAIN & SUB on default project
// ======================================================

for (const brokerLabel of ['MAIN', 'SUB'] as const) {
  const phone =
    brokerLabel === 'MAIN'
      ? BROKER_PHONE.MAIN_BROKER
      : BROKER_PHONE.SUB_BROKER;

  test.describe(`Broker access — SV formats (${brokerLabel} broker)`, () => {
    for (const format of SV_PROMPT_BUILDERS) {
      test(`BRK_SV_FMT_${brokerLabel} - ${format.name} @sanity`, async ({
        request,
      }) => {
        const buyerName = uniqueBuyerName();
        const buyerId = uniqueBuyerId();
        await ensureMicrositeForBroker(
          request,
          phone,
          buyerName,
          buyerId,
          DEFAULT_PROJECT
        );

        const body = await bookSiteVisitForBroker(
          request,
          phone,
          format.build(buyerName, buyerId, DEFAULT_PROJECT)
        );
        assertSiteVisitAllowed(body);
      });
    }
  });
}

// ======================================================
// 6. SANITY — default project + dashboard output
// ======================================================

test.describe('Broker access — sanity spot check', () => {
  test('BRK_SANITY_MAIN microsite + SV + dashboard lead @sanity', async ({
    request,
  }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();
    await ensureMicrositeForBroker(
      request,
      BROKER_PHONE.MAIN_BROKER,
      buyerName,
      buyerId,
      DEFAULT_PROJECT
    );
    const body = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.MAIN_BROKER,
      `${buyerName} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitAllowed(body);
    await assertLeadVisible(request, BROKER_PHONE.MAIN_BROKER, buyerName, buyerId);
  });

  test('BRK_SANITY_SUB microsite + SV + dashboard lead @sanity', async ({
    request,
  }) => {
    const buyerName = uniqueBuyerName();
    const buyerId = uniqueBuyerId();
    await ensureMicrositeForBroker(
      request,
      BROKER_PHONE.SUB_BROKER,
      buyerName,
      buyerId,
      DEFAULT_PROJECT
    );
    const body = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.SUB_BROKER,
      `${buyerName} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitAllowed(body);
    await assertLeadVisible(request, BROKER_PHONE.SUB_BROKER, buyerName, buyerId);
  });
});
