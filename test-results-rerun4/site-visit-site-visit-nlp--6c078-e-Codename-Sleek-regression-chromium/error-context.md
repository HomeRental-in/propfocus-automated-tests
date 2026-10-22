# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-visit/site-visit-nlp-formats.spec.ts >> Site visit NLP — configured projects >> SV_PROJ - Alias "Codename Sleek" site visit for Amberstone Codename Sleek @regression
- Location: tests/site-visit/site-visit-nlp-formats.spec.ts:516:11

# Error details

```
Error: expect(received).toBeTruthy()

Received: undefined
```

# Test source

```ts
  35  | const DEFAULT_PROJECT = getDefaultTestProject();
  36  | const PROJECT = DEFAULT_PROJECT.name;
  37  | 
  38  | // ======================================================
  39  | // TYPES
  40  | // ======================================================
  41  | 
  42  | interface WebhookResponseBody {
  43  |   success: boolean;
  44  |   message: string;
  45  |   micrositeUrl?: string | null;
  46  |   link_token?: string;
  47  |   imageURL?: string | null;
  48  | }
  49  | 
  50  | interface SvNlpContext {
  51  |   buyerName: string;
  52  |   buyerId: string;
  53  |   project: string;
  54  |   visitSlot: string;
  55  | }
  56  | 
  57  | interface SvNlpFormatCase {
  58  |   name: string;
  59  |   tags?: string;
  60  |   needsMicrosite?: boolean;
  61  |   buildBody: (ctx: SvNlpContext) => string;
  62  | }
  63  | 
  64  | interface SvNlpGracefulFailureCase {
  65  |   name: string;
  66  |   buildBody: (ctx: SvNlpContext) => string;
  67  | }
  68  | 
  69  | // ======================================================
  70  | // HELPERS
  71  | // ======================================================
  72  | 
  73  | function uniqueBuyerId(): string {
  74  |   const timestamp = Date.now().toString().slice(-4);
  75  |   const random = Math.floor(100 + Math.random() * 900);
  76  |   return `B${timestamp}${random}`;
  77  | }
  78  | 
  79  | function svContext(overrides?: Partial<SvNlpContext>): SvNlpContext {
  80  |   return {
  81  |     buyerName: BUYER_NAME,
  82  |     buyerId: uniqueBuyerId(),
  83  |     project: PROJECT,
  84  |     visitSlot: SITE_VISIT_DEFAULT_SLOT,
  85  |     ...overrides,
  86  |   };
  87  | }
  88  | 
  89  | async function sendWebhook(
  90  |   request: APIRequestContext,
  91  |   messageBody: string,
  92  |   phone: string = PHONE.ACTIVE
  93  | ): Promise<WebhookResponseBody> {
  94  |   const payload = {
  95  |     data: {
  96  |       event: 'message',
  97  |       data: { from: phone, body: messageBody },
  98  |     },
  99  |   };
  100 | 
  101 |   let response = await request.post(API_URL, payload);
  102 |   let attempts = 0;
  103 | 
  104 |   while (response.status() === 502 && attempts < 3) {
  105 |     attempts += 1;
  106 |     await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
  107 |     response = await request.post(API_URL, payload);
  108 |   }
  109 | 
  110 |   expect(response.status()).toBe(200);
  111 | 
  112 |   const responseBody: WebhookResponseBody = await response.json();
  113 | 
  114 |   console.log(`\nPhone   : ${phone}`);
  115 |   console.log(`Request : ${messageBody}`);
  116 |   console.log(JSON.stringify(responseBody, null, 2));
  117 | 
  118 |   await new Promise((resolve) => setTimeout(resolve, 800));
  119 | 
  120 |   return responseBody;
  121 | }
  122 | 
  123 | async function ensureMicrosite(
  124 |   request: APIRequestContext,
  125 |   ctx: Pick<SvNlpContext, 'buyerName' | 'buyerId' | 'project'>
  126 | ): Promise<void> {
  127 |   const body = await sendWebhook(
  128 |     request,
  129 |     `${ctx.buyerName} ${ctx.buyerId} for ${ctx.project}`
  130 |   );
  131 | 
  132 |   expect(body.success, `Microsite prerequisite failed for ${ctx.project}`).toBe(
  133 |     true
  134 |   );
> 135 |   expect(body.micrositeUrl).toBeTruthy();
      |                             ^ Error: expect(received).toBeTruthy()
  136 | }
  137 | 
  138 | function assertSiteVisitSuccess(body: WebhookResponseBody): void {
  139 |   expect(body.success).toBe(true);
  140 |   expect(body.message).toBeTruthy();
  141 |   expect(body.link_token).toBeTruthy();
  142 | }
  143 | 
  144 | function assertSiteVisitGracefulFailure(body: WebhookResponseBody): void {
  145 |   expect(body.link_token).toBeFalsy();
  146 |   expect(body.message).toBeTruthy();
  147 | 
  148 |   const message = body.message.toLowerCase();
  149 |   const isRejected =
  150 |     message.includes('invalid') ||
  151 |     message.includes('clarification') ||
  152 |     message.includes('ambiguous') ||
  153 |     message.includes('not found') ||
  154 |     message.includes('permission denied') ||
  155 |     message.includes('missing');
  156 | 
  157 |   expect(
  158 |     isRejected,
  159 |     `Expected rejection/clarification message, got: ${body.message}`
  160 |   ).toBe(true);
  161 | }
  162 | 
  163 | function assertAmbiguousSiteVisitFailure(body: WebhookResponseBody): void {
  164 |   expect(body.link_token).toBeFalsy();
  165 |   expect(body.message).toBeTruthy();
  166 | 
  167 |   const message = body.message.toLowerCase();
  168 |   const isAmbiguous =
  169 |     message.includes('ambiguous') ||
  170 |     message.includes('multiple projects') ||
  171 |     message.includes('clarification');
  172 | 
  173 |   expect(
  174 |     isAmbiguous,
  175 |     `Expected ambiguous/clarification response, got: ${body.message}`
  176 |   ).toBe(true);
  177 | }
  178 | 
  179 | function assertPermissionDeniedSiteVisitFailure(
  180 |   body: WebhookResponseBody
  181 | ): void {
  182 |   expect(body.link_token).toBeFalsy();
  183 |   expect(body.message).toBeTruthy();
  184 |   expect(body.message.toLowerCase()).toContain('permission denied');
  185 | }
  186 | 
  187 | async function bookSiteVisitWithMicrosite(
  188 |   request: APIRequestContext,
  189 |   ctx: SvNlpContext,
  190 |   prompt: string
  191 | ): Promise<WebhookResponseBody> {
  192 |   await ensureMicrosite(request, ctx);
  193 |   return sendWebhook(request, prompt);
  194 | }
  195 | 
  196 | // ======================================================
  197 | // NLP FORMAT CASES
  198 | // ======================================================
  199 | 
  200 | const svNlpFormatCases: SvNlpFormatCase[] = [
  201 |   {
  202 |     name: 'SV_NLP_01 - Name ID for sv Project on date time',
  203 |     tags: '@sanity',
  204 |     buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
  205 |       `${buyerName} ${buyerId} for sv ${project} ${visitSlot}`,
  206 |   },
  207 |   {
  208 |     name: 'SV_NLP_02 - for site visit keyword',
  209 |     tags: '@sanity',
  210 |     buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
  211 |       `${buyerName} ${buyerId} for site visit ${project} ${visitSlot}`,
  212 |   },
  213 |   {
  214 |     name: 'SV_NLP_03 - Please book site visit conversational',
  215 |     tags: '@sanity',
  216 |     buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
  217 |       `Please book site visit for ${buyerName} ${buyerId} at ${project} ${visitSlot}`,
  218 |   },
  219 |   {
  220 |     name: 'SV_NLP_04 - Can you schedule a site visit',
  221 |     tags: '@regression',
  222 |     buildBody: ({ buyerName, buyerId, project, visitSlot }) =>
  223 |       `Can you schedule a site visit for ${buyerName} ${buyerId} in ${project} tomorrow 11 AM`,
  224 |   },
  225 |   {
  226 |     name: 'SV_NLP_05 - No time — date only',
  227 |     tags: '@regression',
  228 |     buildBody: ({ buyerName, buyerId, project }) =>
  229 |       `${buyerName} ${buyerId} for sv ${project} on tomorrow`,
  230 |   },
  231 |   {
  232 |     name: 'SV_NLP_06 - Mixed case input',
  233 |     tags: '@regression',
  234 |     buildBody: ({ buyerName, buyerId, project }) =>
  235 |       `${buyerName.toLowerCase()} ${buyerId.toLowerCase()} FoR sV ${project} ToMoRrO 11 aM`,
```