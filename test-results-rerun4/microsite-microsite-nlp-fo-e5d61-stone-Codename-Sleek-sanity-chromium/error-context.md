# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: microsite/microsite-nlp-formats.spec.ts >> Microsite NLP — configured projects >> NLP_PROJ - Single project: Amberstone Codename Sleek @sanity
- Location: tests/microsite/microsite-nlp-formats.spec.ts:627:9

# Error details

```
Error: expect(received).toBeTruthy()

Received: undefined
```

# Test source

```ts
  24  | 
  25  | const API_URL =
  26  |   process.env.API_URL ??
  27  |   'https://dev.propfocus.in/api/whatsapp-webhook';
  28  | 
  29  | const PHONE = {
  30  |   ACTIVE:
  31  |     process.env.TEST_PHONE ??
  32  |     '9999999999',
  33  | } as const;
  34  | 
  35  | const BUYER_NAME = 'Harsha';
  36  | const DEFAULT_PROJECT = getDefaultTestProject();
  37  | const PROJECT = DEFAULT_PROJECT.name;
  38  | const MULTI_PROJECTS = getMultiProjectTestNames();
  39  | const PROJECT_ALT = MULTI_PROJECTS[1] ?? MULTI_PROJECTS[0] ?? PROJECT;
  40  | 
  41  | // ======================================================
  42  | // TYPES
  43  | // ======================================================
  44  | 
  45  | interface MicrositeResponseBody {
  46  |   success: boolean;
  47  |   imageURL?: string | null;
  48  |   micrositeUrl: string | null;
  49  |   message: string;
  50  |   buyerid?: string;
  51  | }
  52  | 
  53  | interface ExpectedFields {
  54  |   buyerName?: string;
  55  |   projectName?: string;
  56  |   buyerId?: string;
  57  | }
  58  | 
  59  | interface NlpFormatCase {
  60  |   name: string;
  61  |   tags?: string;
  62  |   buildBody: (ctx: NlpContext) => string;
  63  |   expectedFields?: ExpectedFields;
  64  |   validateRNR?: boolean;
  65  | }
  66  | 
  67  | interface NlpGracefulFailureCase {
  68  |   name: string;
  69  |   buildBody: (ctx: NlpContext) => string;
  70  | }
  71  | 
  72  | interface NlpContext {
  73  |   buyerName: string;
  74  |   buyerId: string;
  75  |   project: string;
  76  | }
  77  | 
  78  | // ======================================================
  79  | // HELPERS
  80  | // ======================================================
  81  | 
  82  | function uniqueBuyerId(): string {
  83  |   const timestamp = Date.now().toString().slice(-4);
  84  |   const random = Math.floor(100 + Math.random() * 900);
  85  |   return `B${timestamp}${random}`;
  86  | }
  87  | 
  88  | function nlpContext(): NlpContext {
  89  |   return {
  90  |     buyerName: BUYER_NAME,
  91  |     buyerId: uniqueBuyerId(),
  92  |     project: PROJECT,
  93  |   };
  94  | }
  95  | 
  96  | async function sendMicrositeRequest(
  97  |   request: APIRequestContext,
  98  |   messageBody: string,
  99  |   phone: string = PHONE.ACTIVE
  100 | ): Promise<MicrositeResponseBody> {
  101 |   const response = await request.post(API_URL, {
  102 |     data: {
  103 |       event: 'message',
  104 |       data: {
  105 |         from: phone,
  106 |         body: messageBody,
  107 |       },
  108 |     },
  109 |   });
  110 | 
  111 |   expect(response.status()).toBe(200);
  112 | 
  113 |   const responseBody: MicrositeResponseBody = await response.json();
  114 | 
  115 |   console.log(`\nPhone   : ${phone}`);
  116 |   console.log(`Request : ${messageBody}`);
  117 |   console.log(JSON.stringify(responseBody, null, 2));
  118 | 
  119 |   return responseBody;
  120 | }
  121 | 
  122 | function assertSuccess(body: MicrositeResponseBody): void {
  123 |   expect(body.success).toBe(true);
> 124 |   expect(body.micrositeUrl).toBeTruthy();
      |                             ^ Error: expect(received).toBeTruthy()
  125 |   expect(body.message).toBeTruthy();
  126 | }
  127 | 
  128 | function assertGracefulFailure(body: MicrositeResponseBody): void {
  129 |   expect(body.micrositeUrl).toBeFalsy();
  130 |   expect(body.message).toBeTruthy();
  131 | }
  132 | 
  133 | /** Parser found multiple matches — asks user to resend exact project name. */
  134 | function assertAmbiguousProjectFailure(body: MicrositeResponseBody): void {
  135 |   expect(body.micrositeUrl).toBeFalsy();
  136 |   expect(body.message).toBeTruthy();
  137 | 
  138 |   const message = body.message.toLowerCase();
  139 |   const isAmbiguous =
  140 |     message.includes('ambiguous') ||
  141 |     message.includes('multiple projects') ||
  142 |     message.includes('clarification');
  143 | 
  144 |   expect(
  145 |     isAmbiguous,
  146 |     `Expected ambiguous/clarification response, got: ${body.message}`
  147 |   ).toBe(true);
  148 | }
  149 | 
  150 | /** Broker lacks permission for this project on the org. */
  151 | function assertPermissionDeniedFailure(body: MicrositeResponseBody): void {
  152 |   expect(body.micrositeUrl).toBeFalsy();
  153 |   expect(body.message).toBeTruthy();
  154 |   expect(body.message.toLowerCase()).toContain('permission denied');
  155 | }
  156 | 
  157 | function messageContainsProject(
  158 |   message: string,
  159 |   projectName: string
  160 | ): void {
  161 |   const tokens = projectName
  162 |     .toLowerCase()
  163 |     .split(/\s+/)
  164 |     .filter((token) => token.length >= 3);
  165 | 
  166 |   const matched = tokens.some((token) => message.includes(token));
  167 |   expect(
  168 |     matched,
  169 |     `Expected message to mention "${projectName}" (tokens: ${tokens.join(', ')})`
  170 |   ).toBe(true);
  171 | }
  172 | 
  173 | function assertRNR(body: MicrositeResponseBody): void {
  174 |   expect(body.message.toLowerCase()).toContain('tried reaching you');
  175 | }
  176 | 
  177 | function assertExpectedFields(
  178 |   body: MicrositeResponseBody,
  179 |   fields?: ExpectedFields
  180 | ): void {
  181 |   if (!fields) return;
  182 | 
  183 |   const message = body.message.toLowerCase();
  184 | 
  185 |   if (fields.buyerName) {
  186 |     expect(message).toContain(fields.buyerName.toLowerCase());
  187 |   }
  188 | 
  189 |   if (fields.projectName) {
  190 |     messageContainsProject(message, fields.projectName);
  191 |   }
  192 | 
  193 |   if (fields.buyerId) {
  194 |     expect(message).toContain(fields.buyerId.toLowerCase());
  195 |   }
  196 | }
  197 | 
  198 | // ======================================================
  199 | // NLP FORMAT CASES — body built at runtime so each test
  200 | // gets a fresh buyerId.
  201 | // ======================================================
  202 | 
  203 | const nlpFormatCases: NlpFormatCase[] = [
  204 |   // --------------------------------------------------
  205 |   // Standard & compact templates
  206 |   // --------------------------------------------------
  207 |   {
  208 |     name: 'NLP_01 - Name with ID for Project',
  209 |     tags: '@sanity',
  210 |     buildBody: ({ buyerName, buyerId, project }) =>
  211 |       `${buyerName} with ID ${buyerId} for ${project}`,
  212 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  213 |   },
  214 |   {
  215 |     name: 'NLP_02 - Name BuyerID for Project (compact)',
  216 |     tags: '@sanity',
  217 |     buildBody: ({ buyerName, buyerId, project }) =>
  218 |       `${buyerName} ${buyerId} for ${project}`,
  219 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  220 |   },
  221 |   {
  222 |     name: 'NLP_03 - Name BuyerID Project (no "for")',
  223 |     tags: '@sanity',
  224 |     buildBody: ({ buyerName, buyerId, project }) =>
```