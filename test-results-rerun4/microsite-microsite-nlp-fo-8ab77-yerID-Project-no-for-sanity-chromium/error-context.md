# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: microsite/microsite-nlp-formats.spec.ts >> Microsite NLP formats — positive >> NLP_03 - Name BuyerID Project (no "for") @sanity
- Location: tests/microsite/microsite-nlp-formats.spec.ts:555:9

# Error details

```
Error: Expected message to mention "Abhee Tranquila" (tokens: abhee, tranquila)

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
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
  124 |   expect(body.micrositeUrl).toBeTruthy();
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
> 170 |   ).toBe(true);
      |     ^ Error: Expected message to mention "Abhee Tranquila" (tokens: abhee, tranquila)
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
  225 |       `${buyerName} ${buyerId} ${project}`,
  226 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  227 |   },
  228 |   {
  229 |     name: 'NLP_04 - Name with ID Project (no "for" keyword)',
  230 |     tags: '@regression',
  231 |     buildBody: ({ buyerName, buyerId, project }) =>
  232 |       `${buyerName} with ID ${buyerId} ${project}`,
  233 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  234 |   },
  235 |   {
  236 |     name: 'NLP_05 - buyer id lowercase keyword',
  237 |     tags: '@regression',
  238 |     buildBody: ({ buyerName, buyerId, project }) =>
  239 |       `${buyerName} buyer id ${buyerId} for ${project}`,
  240 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  241 |   },
  242 | 
  243 |   // --------------------------------------------------
  244 |   // Conversational / polite phrasing
  245 |   // --------------------------------------------------
  246 |   {
  247 |     name: 'NLP_06 - Please create microsite for client',
  248 |     tags: '@sanity',
  249 |     buildBody: ({ buyerName, buyerId, project }) =>
  250 |       `Please create microsite for ${buyerName} ${buyerId} for ${project}`,
  251 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  252 |   },
  253 |   {
  254 |     name: 'NLP_07 - Can you generate a link for',
  255 |     tags: '@regression',
  256 |     buildBody: ({ buyerName, buyerId, project }) =>
  257 |       `Can you generate a link for ${buyerName} with ID ${buyerId} for ${project}`,
  258 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  259 |   },
  260 |   {
  261 |     name: 'NLP_08 - Need microsite for client',
  262 |     tags: '@regression',
  263 |     buildBody: ({ buyerName, buyerId, project }) =>
  264 |       `Need microsite for client ${buyerName} ${buyerId} ${project}`,
  265 |     expectedFields: { buyerName: BUYER_NAME, projectName: PROJECT },
  266 |   },
  267 |   {
  268 |     name: 'NLP_09 - Client interested in project',
  269 |     tags: '@regression',
  270 |     buildBody: ({ buyerName, buyerId, project }) =>
```