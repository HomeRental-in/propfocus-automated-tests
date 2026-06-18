import {
  test,
  expect,
  APIRequestContext,
} from '@playwright/test';
import {
  SITE_VISIT_BUYER_NAME,
  SITE_VISIT_DEFAULT_SLOT,
  SITE_VISIT_LEGACY_BUYER_ID,
  SITE_VISIT_TEST_PROJECTS,
  getDefaultTestProject,
  getSuccessTestProjects,
  getAmbiguousTestProjects,
  getPermissionDeniedTestProjects,
  getSpellingCasesForConfiguredProjects,
  getUnresolvableSpellingCasesForConfiguredProjects,
} from '../../utils/siteVisitProjects';

// ======================================================
// SITE VISIT GENERATION — NLP FORMAT MATRIX
//
// Flow: microsite must exist for {buyerName}+{buyerId}+{project}
// then user sends site visit NLP: {buyer} {id} for sv {project} on {date}
// ======================================================

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE: process.env.TEST_PHONE ?? '9888898888',
} as const;

const BUYER_NAME = SITE_VISIT_BUYER_NAME;
const DEFAULT_PROJECT = getDefaultTestProject();
const PROJECT = DEFAULT_PROJECT.name;

// ======================================================
// TYPES
// ======================================================

interface WebhookResponseBody {
  success: boolean;
  message: string;
  micrositeUrl?: string | null;
  link_token?: string;
  imageURL?: string | null;
}

interface SvNlpContext {
  buyerName: string;
  buyerId: string;
  project: string;
  visitSlot: string;
}

interface SvNlpFormatCase {
  name: string;
  tags?: string;
  needsMicrosite?: boolean;
  buildBody: (ctx: SvNlpContext) => string;
}

interface SvNlpGracefulFailureCase {
  name: string;
  buildBody: (ctx: SvNlpContext) => string;
}

// ======================================================
// HELPERS
// ======================================================

function uniqueBuyerId(): string {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(100 + Math.random() * 900);
  return `B${timestamp}${random}`;
}

function svContext(overrides?: Partial<SvNlpContext>): SvNlpContext {
  return {
    buyerName: BUYER_NAME,
    buyerId: uniqueBuyerId(),
    project: PROJECT,
    visitSlot: SITE_VISIT_DEFAULT_SLOT,
    ...overrides,
  };
}

async function sendWebhook(
  request: APIRequestContext,
  messageBody: string,
  phone: string = PHONE.ACTIVE
): Promise<WebhookResponseBody> {
  const payload = {
    data: {
      event: 'message',
      data: { from: phone, body: messageBody },
    },
  };

  let response = await request.post(API_URL, payload);
  let attempts = 0;

  while (response.status() === 502 && attempts < 3) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
    response = await request.post(API_URL, payload);
  }

  expect(response.status()).toBe(200);

  const responseBody: WebhookResponseBody = await response.json();

  console.log(`\nPhone   : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(responseBody, null, 2));

  await new Promise((resolve) => setTimeout(resolve, 800));

  return responseBody;
}

async function ensureMicrosite(
  request: APIRequestContext,
  ctx: Pick<SvNlpContext, 'buyerName' | 'buyerId' | 'project'>
): Promise<void> {
  const body = await sendWebhook(
    request,
    `${ctx.buyerName} ${ctx.buyerId} for ${ctx.project}`
  );

  expect(body.success, `Microsite prerequisite failed for ${ctx.project}`).toBe(
    true
  );
  expect(body.micrositeUrl).toBeTruthy();
}

function assertSiteVisitSuccess(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.message).toBeTruthy();
  expect(body.link_token).toBeTruthy();
}

function assertSiteVisitGracefulFailure(body: WebhookResponseBody): void {
  expect(body.link_token).toBeFalsy();
  expect(body.message).toBeTruthy();

  const message = body.message.toLowerCase();
  const isRejected =
    message.includes('invalid') ||
    message.includes('clarification') ||
    message.includes('ambiguous') ||
    message.includes('not found') ||
    message.includes('permission denied') ||
    message.includes('missing');

  expect(
    isRejected,
    `Expected rejection/clarification message, got: ${body.message}`
  ).toBe(true);
}

function assertAmbiguousSiteVisitFailure(body: WebhookResponseBody): void {
  expect(body.link_token).toBeFalsy();
  expect(body.message).toBeTruthy();

  const message = body.message.toLowerCase();
  const isAmbiguous =
    message.includes('ambiguous') ||
    message.includes('multiple projects') ||
    message.includes('clarification');

  expect(
    isAmbiguous,
    `Expected ambiguous/clarification response, got: ${body.message}`
  ).toBe(true);
}

function assertPermissionDeniedSiteVisitFailure(
  body: WebhookResponseBody
): void {
  expect(body.link_token).toBeFalsy();
  expect(body.message).toBeTruthy();
  expect(body.message.toLowerCase()).toContain('permission denied');
}

async function bookSiteVisitWithMicrosite(
  request: APIRequestContext,
  ctx: SvNlpContext,
  prompt: string
): Promise<WebhookResponseBody> {
  await ensureMicrosite(request, ctx);
  return sendWebhook(request, prompt);
}

// ======================================================
// NLP FORMAT CASES
// ======================================================

const svNlpFormatCases: SvNlpFormatCase[] = [
  {
    name: 'SV_NLP_01 - Name ID for sv Project on date time',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
      `${buyerName} ${buyerId} for sv ${project} ${visitSlot}`,
  },
  {
    name: 'SV_NLP_02 - for site visit keyword',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
      `${buyerName} ${buyerId} for site visit ${project} ${visitSlot}`,
  },
  {
    name: 'SV_NLP_03 - Please book site visit conversational',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
      `Please book site visit for ${buyerName} ${buyerId} at ${project} ${visitSlot}`,
  },
  {
    name: 'SV_NLP_04 - Can you schedule a site visit',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
      `Can you schedule a site visit for ${buyerName} ${buyerId} in ${project} tomorrow 11 AM`,
  },
  {
    name: 'SV_NLP_05 - No time — date only',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on tomorrow`,
  },
  {
    name: 'SV_NLP_06 - Mixed case input',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName.toLowerCase()} ${buyerId.toLowerCase()} FoR sV ${project} ToMoRrO 11 aM`,
  },
  {
    name: 'SV_NLP_07 - Extra leading/trailing spaces',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
      `  ${buyerName} ${buyerId} for sv ${project} ${visitSlot}  `,
  },
  {
    name: 'SV_NLP_08 - Wrong field order',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `for sv ${project} ${buyerName} ${buyerId} tomorrow`,
  },
  {
    name: 'SV_NLP_09 - Relative date coming Sunday',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on coming Sunday`,
  },
  {
    name: 'SV_NLP_10 - Multiline input',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName}\n${buyerId} for SV\n${project} at\ntomorrow 11 AM`,
  },
  {
    name: 'SV_NLP_11 - Mr prefix',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `Hello create sv for Mr. ${buyerName} ${buyerId} ${project} on tomorrow`,
  },
  {
    name: 'SV_NLP_12 - Late night time 11 PM',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on tomorrow 11 PM`,
  },
  {
    name: 'SV_NLP_13 - Compact site visit phrase',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} site visit for ${project} on tomorrow 11 AM`,
  },
  {
    name: 'SV_NLP_14 - Minor project typo',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} ${buyerId} for sv Abhee Tranqula on tomorrow 11 AM`,
  },
  {
    name: 'SV_NLP_15 - Legacy buyer ID B123',
    tags: '@sanity',
    needsMicrosite: false,
    buildBody: ({ buyerName, project, visitSlot }) =>
      `${buyerName} ${SITE_VISIT_LEGACY_BUYER_ID} for sv ${project} ${visitSlot}`,
  },
  {
  name: 'SV_NLP_17 - Lowercase input',
  tags: '@regression',
  buildBody: ({ buyerId, project }) =>
    `harsha ${buyerId.toLowerCase()} for sv ${project.toLowerCase()} tomorrow 11 am`,
},
{
  name: 'SV_NLP_18 - Uppercase input',
  tags: '@regression',
  buildBody: ({ buyerId, project }) =>
    `HARSHA ${buyerId.toUpperCase()} FOR SV ${project.toUpperCase()} TOMORROW 11 AM`,
},
{
  name: 'SV_NLP_19 - Mixed case input',
  tags: '@regression',
  buildBody: ({ buyerId, project }) =>
    `HaRsHa ${buyerId} FoR Sv ${project} ToMoRrOw 11 Am`,
},
{
  name: 'SV_NLP_20 - Conversational noise text',
  tags: '@regression',
  buildBody: ({ buyerName, buyerId, project }) =>
    `Hi team, please book a site visit for ${buyerName} ${buyerId} at ${project} tomorrow 11 AM. Thanks.`,
},
{
  name: 'SV_NLP_21 - Urgent request text',
  tags: '@regression',
  buildBody: ({ buyerName, buyerId, project }) =>
    `Need this urgently. ${buyerName} ${buyerId} for sv ${project} tomorrow.`,
},
];

// Relative and absolute date/time phrases brokers commonly type
const svDateTimeCases: SvNlpFormatCase[] = [
  {
    name: 'SV_DATE_01 - coming Saturday with time',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on coming Saturday 11 AM`,
  },
  {
    name: 'SV_DATE_02 - coming Sunday with time',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on coming Sunday 11 AM`,
  },
  {
    name: 'SV_DATE_03 - next Saturday',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on next Saturday 3 PM`,
  },
  {
    name: 'SV_DATE_04 - day after tomorrow',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on day after tomorrow 11 AM`,
  },
  {
    name: 'SV_DATE_05 - this weekend',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on this weekend 10 AM`,
  },
  {
    name: 'SV_DATE_07 - tomorrow 10 AM',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on tomorrow 10 AM`,
  },
  {
    name: 'SV_DATE_08 - tomorrow 2 PM',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on tomorrow 2 PM`,
  },
  {
    name: 'SV_DATE_09 - tomorrow with minutes',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on tomorrow 10:30 AM`,
  },
];

const svDateTimeGracefulFailureCases: SvNlpGracefulFailureCase[] = [
  {
    name: 'SV_DATE_NEG_01 - this 18th',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on this 18th 11 AM`,
  },
  {
    name: 'SV_DATE_NEG_02 - specific calendar date 25th April',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on 25th April 11 AM`,
  },
];

const svGracefulFailureCases: SvNlpGracefulFailureCase[] = [
  {
    name: 'SV_NEG_01 - Empty message',
    buildBody: () => '',
  },
  {
    name: 'SV_NEG_02 - Missing buyer ID',
    buildBody: ({ buyerName, project }) =>
      `${buyerName} for sv ${project} on tomorrow`,
  },
  {
    name: 'SV_NEG_03 - Missing buyer ID',
    buildBody: ({ buyerName, project }) =>
      `${buyerName} for sv ${project} on tomorrow`,
  },
  {
    name: 'SV_NEG_04 - Multiple projects in one request',
    buildBody: ({ buyerName, buyerId, project }) => {
      const alt =
        SITE_VISIT_TEST_PROJECTS.find((p) => p.name !== project)?.name ??
        'KNS Sampada';
      return `${buyerName} ${buyerId} for sv ${project} and ${alt} on tomorrow`;
    },
  },
  {
    name: 'SV_NEG_05 - Past date yesterday',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for sv ${project} on yesterday`,
  },
];

// ======================================================
// NLP FORMAT TESTS
// ======================================================

test.describe('Site visit NLP formats — positive', () => {
  for (const testCase of svNlpFormatCases) {
    test(`${testCase.name} ${testCase.tags ?? '@regression'}`, async ({ request }) => {
      const ctx =
        testCase.needsMicrosite === false
          ? svContext({ buyerId: SITE_VISIT_LEGACY_BUYER_ID })
          : svContext();

      const prompt = testCase.buildBody(ctx);

      const body =
        testCase.needsMicrosite === false
          ? await sendWebhook(request, prompt)
          : await bookSiteVisitWithMicrosite(request, ctx, prompt);

      assertSiteVisitSuccess(body);
    });
  }
});

test.describe('Site visit NLP — date and time variations', () => {
  for (const testCase of svDateTimeCases) {
    test(`${testCase.name} ${testCase.tags ?? '@regression'}`, async ({ request }) => {
      const ctx = svContext();
      const prompt = testCase.buildBody(ctx);
      const body = await bookSiteVisitWithMicrosite(request, ctx, prompt);
      assertSiteVisitSuccess(body);
    });
  }
});

test.describe('Site visit NLP — unsupported date formats', () => {
  for (const testCase of svDateTimeGracefulFailureCases) {
    test(`${testCase.name} @regression`, async ({ request }) => {
      const ctx = svContext();
      await ensureMicrosite(request, ctx);
      const body = await sendWebhook(request, testCase.buildBody(ctx));
      assertSiteVisitGracefulFailure(body);
    });
  }
});

test.describe('Site visit NLP formats — graceful failure', () => {
  for (const testCase of svGracefulFailureCases) {
    test(`${testCase.name} @regression`, async ({ request }) => {
      const ctx = svContext();
      const body = await sendWebhook(request, testCase.buildBody(ctx));
      assertSiteVisitGracefulFailure(body);
    });
  }
});

test(
  'SV_NLP_16 - Same site visit prompt returns same link_token @regression',

  async ({ request }) => {
    const ctx = svContext();
    const prompt = `${ctx.buyerName} ${ctx.buyerId} for sv ${ctx.project} ${ctx.visitSlot}`;

    await ensureMicrosite(request, ctx);

    const first = await sendWebhook(request, prompt);
    const second = await sendWebhook(request, prompt);

    assertSiteVisitSuccess(first);
    assertSiteVisitSuccess(second);
    expect(first.link_token).toBe(second.link_token);
  }
);

// ======================================================
// PROJECT MATRIX — microsite then site visit per project
// ======================================================

test.describe('Site visit NLP — configured projects', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getSuccessTestProjects()) {
    test(
      `SV_PROJ - Site visit for ${project.name} @sanity`,

      async ({ request }) => {
        const ctx = svContext({ project: project.name });
        const body = await bookSiteVisitWithMicrosite(
          request,
          ctx,
          `${ctx.buyerName} ${ctx.buyerId} for sv ${project.name} ${ctx.visitSlot}`
        );

        assertSiteVisitSuccess(body);
      }
    );

    for (const alias of project.aliases ?? []) {
      test(
        `SV_PROJ - Alias "${alias}" site visit for ${project.name} @regression`,

        async ({ request }) => {
          const ctx = svContext({ project: project.name });
          await ensureMicrosite(request, ctx);

          const body = await sendWebhook(
            request,
            `${ctx.buyerName} ${ctx.buyerId} for sv ${alias} ${ctx.visitSlot}`
          );

          assertSiteVisitSuccess(body);
        }
      );
    }
  }
});

// ======================================================
// SPELLING MISTAKES — fuzzy project name in SV prompt
// ======================================================

test.describe('Site visit NLP — project spelling mistakes', () => {
  test.describe.configure({ mode: 'serial' });

  const spellingCases = getSpellingCasesForConfiguredProjects();

  for (const spellingCase of spellingCases) {
    for (const misspelling of spellingCase.misspellings) {
      test(
        `SV_SPELL - "${misspelling}" → ${spellingCase.canonicalName} @regression`,

        async ({ request }) => {
          const ctx = svContext({ project: spellingCase.canonicalName });

          await ensureMicrosite(request, {
            buyerName: ctx.buyerName,
            buyerId: ctx.buyerId,
            project: spellingCase.canonicalName,
          });

          const body = await sendWebhook(
            request,
            `${ctx.buyerName} ${ctx.buyerId} for sv ${misspelling} ${ctx.visitSlot}`
          );

          assertSiteVisitSuccess(body);
        }
      );
    }
  }
});

test.describe('Site visit NLP — unresolvable project spellings', () => {
  for (const spellingCase of getUnresolvableSpellingCasesForConfiguredProjects()) {
    for (const misspelling of spellingCase.misspellings) {
      test(
        `SV_SPELL_NEG - "${misspelling}" @regression`,

        async ({ request }) => {
          const ctx = svContext();
          await ensureMicrosite(request, ctx);

          const body = await sendWebhook(
            request,
            `${ctx.buyerName} ${ctx.buyerId} for sv ${misspelling} ${ctx.visitSlot}`
          );

          assertSiteVisitGracefulFailure(body);
        }
      );
    }
  }
});

// ======================================================
// AMBIGUOUS / PERMISSION DENIED — failed cases (no link_token)
// ======================================================

test.describe('Site visit NLP — ambiguous project (failed case)', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getAmbiguousTestProjects()) {
    test(
      `SV_AMBIG - ${project.name} returns clarification, no site visit link @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendWebhook(
          request,
          `${BUYER_NAME} ${buyerId} for sv ${project.name} on tomorrow 11 AM`
        );

        assertAmbiguousSiteVisitFailure(body);
      }
    );
  }

  test(
    'SV_AMBIG - KNS Athena phase 2 compact prompt @regression',

    async ({ request }) => {
      const body = await sendWebhook(
        request,
        'Harsha B924355 for sv KNS Athena phase 2 on tomorrow'
      );

      assertAmbiguousSiteVisitFailure(body);
    }
  );
});

test.describe('Site visit NLP — permission denied (failed case)', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getPermissionDeniedTestProjects()) {
    test(
      `SV_PERM - ${project.name} returns permission denied, no site visit link @regression`,

      async ({ request }) => {
        const body = await sendWebhook(
          request,
          `${BUYER_NAME} ${SITE_VISIT_LEGACY_BUYER_ID} for sv ${project.name} on tomorrow 11 AM`
        );

        assertPermissionDeniedSiteVisitFailure(body);
      }
    );
  }
});
