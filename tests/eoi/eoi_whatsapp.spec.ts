import {
  test,
  expect,
  APIRequestContext,
} from '@playwright/test';

// ======================================================
// EOI GENERATION — NLP FORMAT MATRIX
//
// Users can type {buyerName} {buyerId} {eoiType} in
// many natural-language shapes. These cases verify the
// webhook parser handles them gracefully (success with
// EOI creation confirmation, or a clear failure —
// never a silent crash).
// ======================================================

const API_URL =
  process.env.EOI_API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {
  ACTIVE:
    process.env.TEST_PHONE ??
    '8374095506',
} as const;

const BUYER_NAME = 'Harsha';
const EOI_TYPE = 'pride pre launch eoi';

// ======================================================
// TYPES
// ======================================================

interface EoiResponseBody {
  success: boolean;
  eoiId?: string;
  eoiUrl?: string | null;
  message: string;
  buyerId?: string;
}

interface ExpectedFields {
  buyerName?: string;
  eoiType?: string;
  buyerId?: string;
}

interface NlpFormatCase {
  name: string;
  tags?: string;
  buildBody: (ctx: NlpContext) => string;
  expectedFields?: ExpectedFields;
}

interface NlpGracefulFailureCase {
  name: string;
  buildBody: (ctx: NlpContext) => string;
}

interface NlpContext {
  buyerName: string;
  buyerId: string;
  eoiType: string;
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
    eoiType: EOI_TYPE,
  };
}

async function sendEoiRequest(
  request: APIRequestContext,
  messageBody: string,
  phone: string = PHONE.ACTIVE
): Promise<EoiResponseBody> {
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

  const responseBody: EoiResponseBody = await response.json();

  console.log(`\nPhone   : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(responseBody, null, 2));

  return responseBody;
}

function assertSuccess(body: EoiResponseBody): void {
  expect(body.success).toBe(true);
  // expect(body.eoiId).toBeTruthy();
  expect(body.message).toBeTruthy();
}

function assertGracefulFailure(body: EoiResponseBody): void {
  expect(body.eoiId).toBeFalsy();
  expect(body.message).toBeTruthy();
}

function eoiTypeContainedInMessage(
  message: string,
  eoiType: string
): void {
  const tokens = eoiType
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  const matched = tokens.some((token) => message.includes(token));
  expect(
    matched,
    `Expected message to mention "${eoiType}" (tokens: ${tokens.join(', ')})`
  ).toBe(true);
}

function assertExpectedFields(response: any, fields: any) {
  expect(response.success).toBe(true);

  const message = response.message?.toLowerCase() ?? '';
  const linkToken = response.linkToken?.toLowerCase() ?? '';
  const eoiUrl = response.eoiUrl?.toLowerCase() ?? '';

  // API success message
  expect(message).toContain('eoi page created');

  // Buyer name is represented in the generated token/URL
  if (fields.buyerName) {
    expect(linkToken).toContain(fields.buyerName.toLowerCase());
  }

  // EOI URL should be generated
  expect(eoiUrl).toBeTruthy();
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
    name: 'NLP_EOI_01 - Name with ID for EOI type',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} with ID ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_02 - Name BuyerID for EOI type (compact)',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_03 - Name BuyerID EOI type (no "for")',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} ${buyerId} ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_04 - Name with ID EOI type (no "for" keyword)',    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} with ID ${buyerId} ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_05 - buyer id lowercase keyword',
    tags: '@regression',   
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} buyer id ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },

  // --------------------------------------------------
  // Conversational / polite phrasing
  // --------------------------------------------------
  {
    name: 'NLP_EOI_06 - Please create EOI for buyer',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `Please create EOI for ${buyerName} ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_07 - Can you generate an EOI for',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `Can you generate an EOI for ${buyerName} with ID ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_08 - Need EOI for buyer',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `Need EOI for ${buyerName} ${buyerId} ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_09 - Buyer interested in EOI type',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} ${buyerId} interested in ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_10 - Submit EOI for buyer',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `Submit EOI for ${buyerName} id ${buyerId} ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },

  // --------------------------------------------------
  // Delimiter variations
  // --------------------------------------------------
  {
    name: 'NLP_EOI_11 - Comma separated Name, ID, EOI type',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName}, ${buyerId}, ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_12 - Dash separated Name - ID - EOI type',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} - ${buyerId} - ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_13 - Pipe separated Name | ID | EOI type',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} | ${buyerId} | ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_14 - Colon separated Name : ID : EOI type',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} : ${buyerId} : ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_15 - Slash between name and EOI type',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} / ${buyerId} / ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },

  // --------------------------------------------------
  // Parentheses & labeled ID
  // --------------------------------------------------
  {
    name: 'NLP_EOI_16 - ID in parentheses',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} (${buyerId}) for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_17 - ID with label in parentheses',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} (ID: ${buyerId}) for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },

  // --------------------------------------------------
  // Field order variations
  // --------------------------------------------------
  {
    name: 'NLP_EOI_18 - For EOI type first then buyer',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `For ${eoiType} - ${buyerName} ${buyerId}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_19 - Name ID comma then EOI type',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} ${buyerId}, ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_20 - Wrong-order conversational input',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `for ${eoiType} ${buyerName} ${buyerId}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },

  // --------------------------------------------------
  // Whitespace, punctuation, multiline
  // --------------------------------------------------
  {
    name: 'NLP_EOI_21 - Leading and trailing spaces',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `  ${buyerName} with ID ${buyerId} for ${eoiType}  `,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_22 - Trailing period',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} with ID ${buyerId} for ${eoiType}.`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_23 - Extra spaces between words',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName}    ${buyerId}    for    ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_24 - Tab-separated fields',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName}\t${buyerId}\t${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_25 - Each field on its own line',
    tags: '@sanity',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName}\n${buyerId}\n${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_26 - Name+ID line then EOI type line',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `${buyerName} ${buyerId}\n${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },

  // --------------------------------------------------
  // Name & EOI type edge shapes (still valid NLP)
  // --------------------------------------------------   
  {
    name: 'NLP_EOI_27 - Two-word buyer name',
    tags: '@regression',
    buildBody: ({ buyerId, eoiType }) =>
      `Rahul Sharma ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: 'Rahul Sharma', eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_28 - Mr prefix with compact ID',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `Mr. ${buyerName} ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_29 - Partial EOI type name',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId }) => {
      const alias = 'pride launch'; // shorter alias for "pre pride launch eoi"
      return `${buyerName} ${buyerId} for ${alias}`;
    },
    expectedFields: { buyerName: BUYER_NAME },
  },
  {
    name: 'NLP_EOI_30 - Emoji prefix',
    tags: '@regression',
    buildBody: ({ buyerName, buyerId, eoiType }) =>
      `📋 ${buyerName} ${buyerId} for ${eoiType}`,
    expectedFields: { buyerName: BUYER_NAME, eoiType: EOI_TYPE },
  },
  {
    name: 'NLP_EOI_31 - Lowercase buyer name and EOI type',
    tags: '@regression',
    buildBody: ({ buyerId, eoiType }) =>
      `harsha ${buyerId} for ${eoiType.toLowerCase()}`,
    expectedFields: {
      buyerName: BUYER_NAME,
      eoiType: EOI_TYPE,
    },
  },
  {
    name: 'NLP_EOI_32 - Uppercase buyer name and EOI type',
    tags: '@regression',
    buildBody: ({ buyerId, eoiType }) =>
      `HARSHA ${buyerId} FOR ${eoiType.toUpperCase()}`,
    expectedFields: {
      buyerName: BUYER_NAME,
      eoiType: EOI_TYPE,
    },
  },
  {
    name: 'NLP_EOI_33 - Mixed case input',
    tags: '@regression',
    buildBody: ({ buyerId, eoiType }) =>
      `HaRsHa ${buyerId} FoR ${eoiType}`,
    expectedFields: {
      buyerName: BUYER_NAME,
      eoiType: EOI_TYPE,
    },
  },
];

// Invalid / missing buyer ID cases live in eoi-generation.spec.ts
// (parser currently accepts some of those inputs — tracked theres).

const nlpGracefulFailureCases: NlpGracefulFailureCase[] = [
  {
    name: 'NLP_EOI_NEG_01 - Empty message',
    buildBody: () => '',
  },
  {
    name: 'NLP_EOI_NEG_02 - Only buyer name',
    buildBody: ({ buyerName }) => buyerName,
  },
  {
    name: 'NLP_EOI_NEG_03 - Only EOI type',
    buildBody: ({ eoiType }) => eoiType,
  },
  {
    name: 'NLP_EOI_NEG_04 - Greeting with no entities',
    buildBody: () => 'Hello, how are you today?',
  },
  {
    name: 'NLP_EOI_NEG_05 - Missing EOI type',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} with ID ${buyerId}`,
  },
  {
    name: 'NLP_EOI_NEG_06 - Unknown EOI type',
    buildBody: ({ buyerName, buyerId }) =>
      `${buyerName} with ID ${buyerId} for imaginary eoi launch phase 99`,
  },
  {
    name: 'NLP_EOI_NEG_07 - Numeric-only buyer name',
    buildBody: ({ buyerId, eoiType }) =>
      `12345 ${buyerId} for ${eoiType}`,
  },
  {
    name: 'NLP_EOI_NEG_08 - Special characters only',
    buildBody: () => '@@@ ### $$$',
  },
];

// ======================================================
// POSITIVE NLP FORMAT TESTS
// ======================================================

test.describe('EOI NLP formats — positive', () => {
  for (const testCase of nlpFormatCases) {
    test(
      `${testCase.name} ${testCase.tags ?? '@regression'}`,

      async ({ request }) => {
        const ctx = nlpContext();
        const body = await sendEoiRequest(
          request,
          testCase.buildBody(ctx)
        );

        assertSuccess(body);
        assertExpectedFields(body, testCase.expectedFields);
      }
    );
  }
});

// ======================================================
// GRACEFUL FAILURE — parser must reject bad input cleanly
// ======================================================

test.describe('EOI NLP formats — graceful failure', () => {
  for (const testCase of nlpGracefulFailureCases) {
    test(
      `${testCase.name} @regression`,

      async ({ request }) => {
        const ctx = nlpContext();
        const body = await sendEoiRequest(
          request,
          testCase.buildBody(ctx)
        );

        assertGracefulFailure(body);
      }
    );
  }
});

// ======================================================
// IDEMPOTENCY — same NLP prompt returns same EOI
// ======================================================

test(
  'NLP_EOI_IDEMPOTENT - Same NLP prompt returns same EOI ID @regression',

  async ({ request }) => {
    const ctx = nlpContext();
    const prompt = `${ctx.buyerName} ${ctx.buyerId} for ${ctx.eoiType}`;

    const first = await sendEoiRequest(request, prompt);
    const second = await sendEoiRequest(request, prompt);

    assertSuccess(first);
    assertSuccess(second);
    expect(first.eoiId).toBe(second.eoiId);
  }
);

// ======================================================
// EOI TYPE VARIATIONS — different launch types
// ======================================================

test.describe('EOI NLP — EOI type variations', () => {
  const eoiVariations = [
    'pre pride launch eoi',
    'pride launch eoi',
    'pride eoi',
    'pre-pride eoi',
  ];

  for (const eoiVariant of eoiVariations) {
    test(
      `NLP_EOI_TYPE - "${eoiVariant}" @regression`,

      async ({ request }) => {
        const ctx = nlpContext();
        const body = await sendEoiRequest(
          request,
          `${ctx.buyerName} ${ctx.buyerId} for ${eoiVariant}`
        );

        assertSuccess(body);
        assertExpectedFields(body, {
          buyerName: BUYER_NAME,
          eoiType: eoiVariant,
        });
      }
    );
  }
});