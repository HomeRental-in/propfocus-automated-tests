import { test } from '@playwright/test';
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
import {
  getDefaultTestProject,
  getSuccessTestProjects,
} from '../../utils/micrositeProjects';
import { SITE_VISIT_DEFAULT_SLOT } from '../../utils/siteVisitProjects';

// ======================================================
// EXTENSIVE BROKER ACCESS
//
// • All success projects × MAIN / SUB / INACTIVE / SUSPENDED
// • Microsite + site visit (SV) link_token per broker
// • Cross-broker SV (microsite on one broker, SV on another)
// • SV NLP + date phrases on MAIN and SUB (default project)
// ======================================================

const BUYER_NAME = 'Harsha';
const DEFAULT_PROJECT = getDefaultTestProject().name;
const ALL_SUCCESS_PROJECTS = getSuccessTestProjects();

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
    knownDevGap: true,
  },
] as const;

// ======================================================
// 1. FULL PROJECT MATRIX — every success project
// ======================================================

test.describe('Broker access — microsite all projects', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of ALL_SUCCESS_PROJECTS) {
    test(
      `BRK_MS_MAIN - ${project.name} @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendBrokerWebhook(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`,
          BROKER_PHONE.MAIN_BROKER
        );
        assertMicrositeAllowed(body);
      }
    );

    test(
      `BRK_MS_SUB - ${project.name} @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendBrokerWebhook(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`,
          BROKER_PHONE.SUB_BROKER
        );
        assertMicrositeAllowed(body);
      }
    );

    test(
      `BRK_MS_INACTIVE - ${project.name} blocked @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendBrokerWebhook(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`,
          BROKER_PHONE.INACTIVE
        );
        assertMicrositeBlocked(body);
      }
    );

    test(
      `BRK_MS_SUSPENDED - ${project.name} blocked @regression`,

      async ({ request }) => {
        test.fail();

        const buyerId = uniqueBuyerId();
        const body = await sendBrokerWebhook(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`,
          BROKER_PHONE.SUSPENDED
        );
        assertMicrositeBlocked(body);
      }
    );
  }
});

test.describe('Broker access — site visit all projects', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of ALL_SUCCESS_PROJECTS) {
    const svPrompt = (buyerId: string) =>
      `${BUYER_NAME} ${buyerId} for sv ${project.name} ${SITE_VISIT_DEFAULT_SLOT}`;

    test(
      `BRK_SV_MAIN - ${project.name} @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        await ensureMicrositeForBroker(
          request,
          BROKER_PHONE.MAIN_BROKER,
          BUYER_NAME,
          buyerId,
          project.name
        );
        const body = await bookSiteVisitForBroker(
          request,
          BROKER_PHONE.MAIN_BROKER,
          svPrompt(buyerId)
        );
        assertSiteVisitAllowed(body);
      }
    );

    test(
      `BRK_SV_SUB - ${project.name} @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        await ensureMicrositeForBroker(
          request,
          BROKER_PHONE.SUB_BROKER,
          BUYER_NAME,
          buyerId,
          project.name
        );
        const body = await bookSiteVisitForBroker(
          request,
          BROKER_PHONE.SUB_BROKER,
          svPrompt(buyerId)
        );
        assertSiteVisitAllowed(body);
      }
    );

    test(
      `BRK_SV_INACTIVE - ${project.name} blocked @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await bookSiteVisitForBroker(
          request,
          BROKER_PHONE.INACTIVE,
          svPrompt(buyerId)
        );
        assertSiteVisitBlocked(body);
      }
    );

    test(
      `BRK_SV_SUSPENDED - ${project.name} blocked @regression`,

      async ({ request }) => {
        test.fail();

        const buyerId = uniqueBuyerId();
        const body = await bookSiteVisitForBroker(
          request,
          BROKER_PHONE.SUSPENDED,
          svPrompt(buyerId)
        );
        assertSiteVisitBlocked(body);
      }
    );
  }
});

// ======================================================
// 2. PROJECT ALIASES — MAIN & SUB brokers
// ======================================================

test.describe('Broker access — site visit via project aliases', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of ALL_SUCCESS_PROJECTS) {
    for (const alias of project.aliases ?? []) {
      test(
        `BRK_SV_ALIAS_MAIN - "${alias}" → ${project.name} @regression`,

        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          await ensureMicrositeForBroker(
            request,
            BROKER_PHONE.MAIN_BROKER,
            BUYER_NAME,
            buyerId,
            project.name
          );
          const body = await bookSiteVisitForBroker(
            request,
            BROKER_PHONE.MAIN_BROKER,
            `${BUYER_NAME} ${buyerId} for sv ${alias} ${SITE_VISIT_DEFAULT_SLOT}`
          );
          assertSiteVisitAllowed(body);
        }
      );

      test(
        `BRK_SV_ALIAS_SUB - "${alias}" → ${project.name} @regression`,

        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          await ensureMicrositeForBroker(
            request,
            BROKER_PHONE.SUB_BROKER,
            BUYER_NAME,
            buyerId,
            project.name
          );
          const body = await bookSiteVisitForBroker(
            request,
            BROKER_PHONE.SUB_BROKER,
            `${BUYER_NAME} ${buyerId} for sv ${alias} ${SITE_VISIT_DEFAULT_SLOT}`
          );
          assertSiteVisitAllowed(body);
        }
      );
    }
  }
});

// ======================================================
// 3. CROSS-BROKER SITE VISIT
// ======================================================

test.describe('Broker access — cross-broker site visit', () => {
  test.describe.configure({ mode: 'serial' });

  for (const testCase of CROSS_BROKER_CASES) {
    test(
      `BRK_X_SV - ${testCase.name} @regression`,

      async ({ request }) => {
        if (testCase.knownDevGap) {
          test.fail();
        }

        const buyerId = uniqueBuyerId();
        await ensureMicrositeForBroker(
          request,
          testCase.micrositePhone,
          BUYER_NAME,
          buyerId,
          DEFAULT_PROJECT
        );

        const body = await bookSiteVisitForBroker(
          request,
          testCase.svPhone,
          `${BUYER_NAME} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
        );

        if (testCase.expectSvAllowed) {
          assertSiteVisitAllowed(body);
        } else {
          assertSiteVisitBlocked(body);
        }
      }
    );
  }
});

// ======================================================
// 4. INACTIVE / SUSPENDED cannot create microsite then SV
// ======================================================

test.describe('Broker access — blocked brokers cannot chain microsite + SV', () => {
  test.describe.configure({ mode: 'serial' });

  test('BRK_CHAIN_INACTIVE - microsite blocked @regression', async ({ request }) => {
    const buyerId = uniqueBuyerId();
    const ms = await sendBrokerWebhook(
      request,
      `${BUYER_NAME} ${buyerId} for ${DEFAULT_PROJECT}`,
      BROKER_PHONE.INACTIVE
    );
    assertMicrositeBlocked(ms);

    const sv = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.INACTIVE,
      `${BUYER_NAME} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitBlocked(sv);
  });

  test('BRK_CHAIN_SUSPENDED - microsite should be blocked @regression', async ({
    request,
  }) => {
    test.fail();

    const buyerId = uniqueBuyerId();
    const ms = await sendBrokerWebhook(
      request,
      `${BUYER_NAME} ${buyerId} for ${DEFAULT_PROJECT}`,
      BROKER_PHONE.SUSPENDED
    );
    assertMicrositeBlocked(ms);

    const sv = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.SUSPENDED,
      `${BUYER_NAME} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
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
    test.describe.configure({ mode: 'serial' });

    for (const format of SV_PROMPT_BUILDERS) {
      test(
        `BRK_SV_FMT_${brokerLabel} - ${format.name} @sanity`,

        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          await ensureMicrositeForBroker(
            request,
            phone,
            BUYER_NAME,
            buyerId,
            DEFAULT_PROJECT
          );

          const body = await bookSiteVisitForBroker(
            request,
            phone,
            format.build(BUYER_NAME, buyerId, DEFAULT_PROJECT)
          );
          assertSiteVisitAllowed(body);
        }
      );
    }
  });
}

// ======================================================
// 6. SANITY SPOT — default project quick check all brokers
// ======================================================

test.describe('Broker access — sanity spot check', () => {
  test('BRK_SANITY_MAIN microsite + SV @sanity', async ({ request }) => {
    const buyerId = uniqueBuyerId();
    await ensureMicrositeForBroker(
      request,
      BROKER_PHONE.MAIN_BROKER,
      BUYER_NAME,
      buyerId,
      DEFAULT_PROJECT
    );
    const body = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.MAIN_BROKER,
      `${BUYER_NAME} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitAllowed(body);
  });

  test('BRK_SANITY_SUB microsite + SV @sanity', async ({ request }) => {
    const buyerId = uniqueBuyerId();
    await ensureMicrositeForBroker(
      request,
      BROKER_PHONE.SUB_BROKER,
      BUYER_NAME,
      buyerId,
      DEFAULT_PROJECT
    );
    const body = await bookSiteVisitForBroker(
      request,
      BROKER_PHONE.SUB_BROKER,
      `${BUYER_NAME} ${buyerId} for sv ${DEFAULT_PROJECT} ${SITE_VISIT_DEFAULT_SLOT}`
    );
    assertSiteVisitAllowed(body);
  });
});
