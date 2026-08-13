import {
  test,
  expect,
  APIRequestContext,
} from '@playwright/test';
import {
  getAutomationTestProjects,
  getAmbiguousTestProjects,
  getDefaultTestProject,
  getMultiProjectTestNames,
  getPermissionDeniedTestProjects,
  getSpellingCasesForConfiguredProjects,
  getUnresolvableSpellingCasesForConfiguredProjects,
} from '../../utils/micrositeProjects';

// ======================================================
// MICROSITE GENERATION — NLP FORMAT MATRIX
//
// Users can type {buyerName} {buyerId} {projectNames} in
// many natural-language shapes. These cases verify the
// webhook parser handles them gracefully (success with a
// link, or a clear failure — never a silent crash).
// ======================================================

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE:
    process.env.TEST_PHONE ??
    '9888898888',
} as const;

const BUYER_NAME = 'Harsha';
const DEFAULT_PROJECT = getDefaultTestProject();
const PROJECT = DEFAULT_PROJECT.name;
const MULTI_PROJECTS = getMultiProjectTestNames();
const PROJECT_ALT = MULTI_PROJECTS[1] ?? MULTI_PROJECTS[0] ?? PROJECT;

// ======================================================
// TYPES
// ======================================================

interface MicrositeResponseBody {
  success: boolean;
  imageURL?: string | null;
  micrositeUrl: string | null;
  message: string;
  buyerid?: string;
}

interface ExpectedFields {
  buyerName?: string;
  projectName?: string;
  buyerId?: string;
}

interface NlpFormatCase {
  name: string;
  tags?: string;
  buildBody: (ctx: NlpContext) => string;
  expectedFields?: ExpectedFields;
  validateRNR?: boolean;
}

interface NlpGracefulFailureCase {
  name: string;
  buildBody: (ctx: NlpContext) => string;
}

interface NlpContext {
  buyerName: string;
  buyerId: string;
  project: string;
}

// ======================================================
// HELPERS
// ======================================================

function uniqueBuyerId(): string {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(100 + Math.random() * 900);
  return `B${timestamp}${random}`;
}

function nlpContext(): NlpContext {
  return {
    buyerName: BUYER_NAME,
    buyerId: uniqueBuyerId(),
    project: PROJECT,
  };
}

async function sendMicrositeRequest(
  request: APIRequestContext,
  messageBody: string,
  phone: string = PHONE.ACTIVE
): Promise<MicrositeResponseBody> {
  const response = await request.post(API_URL, {
    data: {
      event: 'message',
      data: {
        from: phone,
        body: messageBody,
      },
    },
  });

  expect(response.status()).toBe(200);

  const responseBody: MicrositeResponseBody = await response.json();

  console.log(`\nPhone   : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(responseBody, null, 2));

  return responseBody;
}

function assertSuccess(body: MicrositeResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.micrositeUrl).toBeTruthy();
  expect(body.message).toBeTruthy();
}

function assertGracefulFailure(body: MicrositeResponseBody): void {
  expect(body.micrositeUrl).toBeFalsy();
  expect(body.message).toBeTruthy();
}

/** Parser found multiple matches — asks user to resend exact project name. */
function assertAmbiguousProjectFailure(body: MicrositeResponseBody): void {
  expect(body.micrositeUrl).toBeFalsy();
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

/** Broker lacks permission for this project on the org. */
function assertPermissionDeniedFailure(body: MicrositeResponseBody): void {
  expect(body.micrositeUrl).toBeFalsy();
  expect(body.message).toBeTruthy();
  expect(body.message.toLowerCase()).toContain('permission denied');
}

function messageContainsProject(
  message: string,
  projectName: string
): void {
  const tokens = projectName
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  const matched = tokens.some((token) => message.includes(token));
  expect(
    matched,
    `Expected message to mention "${projectName}" (tokens: ${tokens.join(', ')})`
  ).toBe(true);
}

function assertRNR(body: MicrositeResponseBody): void {
  expect(body.message.toLowerCase()).toContain('tried reaching you');
}

function assertExpectedFields(
  body: MicrositeResponseBody,
  fields?: ExpectedFields
): void {
  if (!fields) return;

  const message = body.message.toLowerCase();

  if (fields.buyerName) {
    expect(message).toContain(fields.buyerName.toLowerCase());
  }

  if (fields.projectName) {
    messageContainsProject(message, fields.projectName);
  }

  if (fields.buyerId) {
    expect(message).toContain(fields.buyerId.toLowerCase());
  }
}

// ======================================================
// NLP FORMAT CASES — body built at runtime so each test
// gets a fresh buyerId.
// ======================================================

const nlpFormatCases: NlpFormatCase[] = [
  // --------------------------------------------------
  // Standard & compact templates
  // --------------------------------------------------
  {
    name: 'NLP_01 - Name with ID for Project',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} with ID ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_02 - Name BuyerID for Project (compact)',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_03 - Name BuyerID Project (no "for")',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_04 - Name with ID Project (no "for" keyword)',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} with ID ${buyerId} ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_05 - buyer id lowercase keyword',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} buyer id ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },

  // --------------------------------------------------
  // Conversational / polite phrasing
  // --------------------------------------------------
  {
    name: 'NLP_06 - Please create microsite for client',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `Please create microsite for ${buyerName} ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_07 - Can you generate a link for',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `Can you generate a link for ${buyerName} with ID ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_08 - Need microsite for client',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `Need microsite for client ${buyerName} ${buyerId} ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_09 - Client interested in project',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId} interested in ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_10 - Share details for buyer',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `Share project details for ${buyerName} id ${buyerId} ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },

  // --------------------------------------------------
  // Delimiter variations
  // --------------------------------------------------
  {
    name: 'NLP_11 - Comma separated Name, ID, Project',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName}, ${buyerId}, ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_12 - Dash separated Name - ID - Project',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} - ${buyerId} - ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_13 - Pipe separated Name | ID | Project',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} | ${buyerId} | ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_14 - Colon separated Name : ID : Project',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} : ${buyerId} : ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_15 - Slash between name and project',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} / ${buyerId} / ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },

  // --------------------------------------------------
  // Parentheses & labeled ID
  // --------------------------------------------------
  {
    name: 'NLP_16 - ID in parentheses',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} (${buyerId}) for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_17 - ID with label in parentheses',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} (ID: ${buyerId}) for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },

  // --------------------------------------------------
  // Field order variations
  // --------------------------------------------------
  {
    name: 'NLP_18 - For project first then buyer',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `For ${project} - ${buyerName} ${buyerId}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_19 - Name ID comma then project',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId}, ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_20 - Wrong-order conversational input',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `for ${project} ${buyerName} ${buyerId}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },

  // --------------------------------------------------
  // Multiple projects
  // --------------------------------------------------
  {
    name: 'NLP_21 - Multiple projects with "and"',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} with ID ${buyerId} for ${PROJECT} and ${PROJECT_ALT}`,
    expectedFields: { buyerName: BUYER_NAME },
  },
  {
    name: 'NLP_22 - Multiple projects comma-separated',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} ${buyerId} for ${PROJECT}, ${PROJECT_ALT}`,
    expectedFields: { buyerName: BUYER_NAME },
  },
  {
    name: 'NLP_23 - Multiple projects slash-separated',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} ${buyerId} for ${PROJECT} / ${PROJECT_ALT}`,
    expectedFields: { buyerName: BUYER_NAME },
  },

  // --------------------------------------------------
  // Whitespace, punctuation, multiline
  // --------------------------------------------------
  {
    name: 'NLP_24 - Leading and trailing spaces',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `  ${buyerName} with ID ${buyerId} for ${project}  `,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_25 - Trailing period',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} with ID ${buyerId} for ${project}.`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_26 - Extra spaces between words',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName}    ${buyerId}    for    ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_27 - Tab-separated fields',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName}\t${buyerId}\t${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_28 - Each field on its own line',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName}\n${buyerId}\n${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_29 - Name+ID line then project line',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} ${buyerId}\n${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },

  // --------------------------------------------------
  // Name & project edge shapes (still valid NLP)
  // --------------------------------------------------
  {
    name: 'NLP_30 - Two-word buyer name',
    tags: '@regression',
    buildBody: ({ buyerId, project }) =>
      `Rahul Sharma ${buyerId} for ${project}`,
    expectedFields: { buyerName: 'Rahul Sharma', projectName: PROJECT },
  },
  {
    name: 'NLP_31 - Mr prefix with compact ID',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `Mr. ${buyerName} ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_32 - Partial project name',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId }) => {
      const alias = DEFAULT_PROJECT.aliases?.[0] ?? PROJECT.split(' ').pop()!;
      return `${buyerName} ${buyerId} for ${alias}`;
    },
    expectedFields: { buyerName: BUYER_NAME },
  },
  {
    name: 'NLP_33 - RNR suffix',
    tags: '@regression',
    validateRNR: true,
    buildBody: ({ buyerName, buyerId, project }) =>
      `${buyerName} with ID ${buyerId} for ${project} RNR`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
    name: 'NLP_34 - Emoji prefix',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, project }) =>
      `🏠 ${buyerName} ${buyerId} for ${project}`,
    expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  },
  {
  name: 'NLP_35 - Lowercase buyer name and project',
  tags: '@regression',
  buildBody: ({ buyerId, project }) =>
    `harsha ${buyerId} for ${project.toLowerCase()}`,
  expectedFields: {
    buyerName: BUYER_NAME,
    projectName: PROJECT,
  },
},
{
  name: 'NLP_36 - Uppercase buyer name and project',
  tags: '@regression',
  buildBody: ({ buyerId, project }) =>
    `HARSHA ${buyerId} FOR ${project.toUpperCase()}`,
  expectedFields: {
    buyerName: BUYER_NAME,
    projectName: PROJECT,
  },
},
{
  name: 'NLP_37 - Mixed case input',
  tags: '@regression',
  buildBody: ({ buyerId, project }) =>
    `HaRsHa ${buyerId} FoR ${project}`,
  expectedFields: {
    buyerName: BUYER_NAME,
    projectName: PROJECT,
  },
},
];

// Invalid / missing buyer ID cases live in microsite-generation.spec.ts
// (parser currently accepts some of those inputs — tracked there).

const nlpGracefulFailureCases: NlpGracefulFailureCase[] = [
  {
    name: 'NLP_NEG_01 - Empty message',
    buildBody: () => '',
  },
  {
    name: 'NLP_NEG_02 - Only buyer name',
    buildBody: ({ buyerName }) => buyerName,
  },
  {
    name: 'NLP_NEG_03 - Only project name',
    buildBody: ({ project }) => project,
  },
  {
    name: 'NLP_NEG_04 - Greeting with no entities',
    buildBody: () => 'Hello, how are you today?',
  },
  {
    name: 'NLP_NEG_05 - Missing project',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} with ID ${buyerId}`,
  },
  {
    name: 'NLP_NEG_06 - Unknown project',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} with ID ${buyerId} for Imaginary Towers Phase 99`,
  },
  {
    name: 'NLP_NEG_08 - Numeric-only buyer name',
    buildBody: ({ buyerId, project }) =>
      `12345 ${buyerId} for ${project}`,
  },
  {
    name: 'NLP_NEG_09 - Special characters only',
    buildBody: () => '@@@ ### $$$',
  },
];

// ======================================================
// POSITIVE NLP FORMAT TESTS
// ======================================================

test.describe('Microsite NLP formats — positive', () => {
  for (const testCase of nlpFormatCases) {
    test(
      `${testCase.name} ${testCase.tags ?? '@regression'}`,

      async ({ request }) => {
        const ctx = nlpContext();
        const body = await sendMicrositeRequest(
          request,
          testCase.buildBody(ctx)
        );

        assertSuccess(body);

        if (testCase.validateRNR) {
          assertRNR(body);
        }

        assertExpectedFields(body, testCase.expectedFields);
      }
    );
  }
});

// ======================================================
// GRACEFUL FAILURE — parser must reject bad input cleanly
// ======================================================

test.describe('Microsite NLP formats — graceful failure', () => {
  for (const testCase of nlpGracefulFailureCases) {
    test(
      `${testCase.name} @regression`,

      async ({ request }) => {
        const ctx = nlpContext();
        const body = await sendMicrositeRequest(
          request,
          testCase.buildBody(ctx)
        );

        assertGracefulFailure(body);
      }
    );
  }
});

// ======================================================
// IDEMPOTENCY — same NLP prompt returns same link
// ======================================================

test(
  'NLP_36 - Same NLP prompt returns same microsite URL @regression',

  async ({ request }) => {
    const ctx = nlpContext();
    const prompt = `${ctx.buyerName} ${ctx.buyerId} for ${ctx.project}`;

    const first = await sendMicrositeRequest(request, prompt);
    const second = await sendMicrositeRequest(request, prompt);

    assertSuccess(first);
    assertSuccess(second);
    expect(first.micrositeUrl).toBe(second.micrositeUrl);
  }
);

// ======================================================
// PROJECT MATRIX — one generation test per configured project
// ======================================================

test.describe('Microsite NLP — configured projects', () => {
  const automationProjects = getAutomationTestProjects();

  for (const project of automationProjects) {
    test(
      `NLP_PROJ - Single project: ${project.name} @sanity`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendMicrositeRequest(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`
        );

        assertSuccess(body);
        assertExpectedFields(body, {
          buyerName: BUYER_NAME,
          projectName: project.name,
        });
      }
    );

    for (const alias of project.aliases ?? []) {
      test(
        `NLP_PROJ - Alias "${alias}" resolves to ${project.name} @regression`,

        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          const body = await sendMicrositeRequest(
            request,
            `${BUYER_NAME} ${buyerId} for ${alias}`
          );

          assertSuccess(body);
          assertExpectedFields(body, {
            buyerName: BUYER_NAME,
            projectName: project.name,
          });
        }
      );
    }
  }

  if (MULTI_PROJECTS.length >= 2) {
    test(
      `NLP_PROJ - Multi project combo (${MULTI_PROJECTS.slice(0, 3).join(' + ')}) @sanity`,

      async ({ request }) => {
        const selected = MULTI_PROJECTS.slice(0, 3);
        const buyerId = uniqueBuyerId();
        const projectList = selected.join(', ');

        const body = await sendMicrositeRequest(
          request,
          `${BUYER_NAME} with ID ${buyerId} for ${projectList}`
        );

        assertSuccess(body);
        assertExpectedFields(body, { buyerName: BUYER_NAME });

        const message = body.message.toLowerCase();
        for (const projectName of selected) {
          messageContainsProject(message, projectName);
        }
      }
    );
  }
});

// ======================================================
// SPELLING MISTAKES — fuzzy match should resolve to canonical
// ======================================================

test.describe('Microsite NLP — project spelling mistakes', () => {
  const spellingCases = getSpellingCasesForConfiguredProjects();

  for (const spellingCase of spellingCases) {
    for (const misspelling of spellingCase.misspellings) {
      test(
        `NLP_SPELL - "${misspelling}" → ${spellingCase.canonicalName} @regression`,

        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          const body = await sendMicrositeRequest(
            request,
            `${BUYER_NAME} with ID ${buyerId} for ${misspelling}`
          );

          assertSuccess(body);
          assertExpectedFields(body, {
            buyerName: BUYER_NAME,
            projectName: spellingCase.canonicalName,
          });
        }
      );
    }
  }
});

// ======================================================
// UNRESOLVABLE SPELLING — too wrong; must fail gracefully
// ======================================================

test.describe('Microsite NLP — unresolvable project spellings', () => {
  const unresolvableCases = getUnresolvableSpellingCasesForConfiguredProjects();

  for (const spellingCase of unresolvableCases) {
    for (const misspelling of spellingCase.misspellings) {
      test(
        `NLP_SPELL_NEG - "${misspelling}" (near ${spellingCase.canonicalName}) @regression`,

        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          const body = await sendMicrositeRequest(
            request,
            `${BUYER_NAME} with ID ${buyerId} for ${misspelling}`
          );

          assertGracefulFailure(body);
        }
      );
    }
  }
});

// ======================================================
// AMBIGUOUS PROJECT — multiple matches, no microsite link
// e.g. "Harsha B924355 for KNS Athena phase 2" → clarification
// ======================================================

test.describe('Microsite NLP — ambiguous project (failed case)', () => {
  for (const project of getAmbiguousTestProjects()) {
    test(
      `NLP_AMBIG - ${project.name} returns clarification, no link @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendMicrositeRequest(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`
        );

        assertAmbiguousProjectFailure(body);
      }
    );
  }

  test(
    'NLP_AMBIG - KNS Athena phase 2 compact prompt (user screenshot) @regression',

    async ({ request }) => {
      const body = await sendMicrositeRequest(
        request,
        'Harsha B924355 for KNS Athena phase 2'
      );

      assertAmbiguousProjectFailure(body);
    }
  );
});

// ======================================================
// PERMISSION DENIED — broker cannot access project
// ======================================================

test.describe('Microsite NLP — permission denied (failed case)', () => {
  for (const project of getPermissionDeniedTestProjects()) {
    test(
      `NLP_PERM - ${project.name} returns permission denied, no link @regression`,

      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const body = await sendMicrositeRequest(
          request,
          `${BUYER_NAME} ${buyerId} for ${project.name}`
        );

        assertPermissionDeniedFailure(body);
      }
    );
  }
});
