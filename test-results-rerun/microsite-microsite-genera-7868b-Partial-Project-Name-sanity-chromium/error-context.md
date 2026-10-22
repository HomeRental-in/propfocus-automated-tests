# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: microsite/microsite-generation.spec.ts >> Microsite Positive - Partial Project Name @sanity
- Location: tests/microsite/microsite-generation.spec.ts:485:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "abhee"
Received string:    "harsha
hi"
```

# Test source

```ts
  91  | 
  92  |   const response = await request.post(  // Sends a POST request to the specified API_URL with a JSON body containing the event type and data, which includes the phone number and message body. This simulates the incoming message that triggers microsite generation in the application.
  93  |     API_URL,
  94  |     {
  95  |       data: {
  96  |         event: 'message',
  97  |         data: {
  98  |           from: phone,
  99  |           body: messageBody
  100 |         }
  101 |       }
  102 |     }
  103 |   );
  104 | 
  105 |   expect(response.status()).toBe(200);
  106 | 
  107 |   const responseBody:
  108 |     MicrositeResponseBody =
  109 |       await response.json();
  110 | 
  111 |   console.log(
  112 |     `\nPhone      : ${phone}`
  113 |   );
  114 | 
  115 |   console.log(
  116 |     `Request    : ${messageBody}`
  117 |   );
  118 | 
  119 |   console.log(
  120 |     JSON.stringify(
  121 |       responseBody,
  122 |       null,
  123 |       2
  124 |     )
  125 |   );
  126 | 
  127 |   return {
  128 |     response,
  129 |     responseBody
  130 |   };
  131 | }
  132 | 
  133 | // ======================================================
  134 | // ASSERTIONS
  135 | // ======================================================
  136 | 
  137 | function assertSuccess(          // assertion function to validate that the microsite generation was successful based on the response body, checking that the success flag is true and that a microsite URL is present in the response
  138 |   body: MicrositeResponseBody
  139 | ) {
  140 | 
  141 |   expect(body.success)
  142 |     .toBe(true);
  143 | 
  144 |   expect(body.micrositeUrl)
  145 |     .toBeTruthy();
  146 | 
  147 | }
  148 | 
  149 | function assertFailure(
  150 |   body: MicrositeResponseBody
  151 | ) {
  152 | 
  153 |   expect(body.success)
  154 |     .not.toBe(true);
  155 | 
  156 |   expect(body.micrositeUrl)
  157 |     .toBeFalsy();
  158 | 
  159 | }
  160 | 
  161 | function assertRNR(
  162 |   body: MicrositeResponseBody
  163 | ) {
  164 | 
  165 |   expect(
  166 |     body.message.toLowerCase()
  167 |   ).toContain(
  168 |     'tried reaching you'
  169 |   );
  170 | 
  171 | }
  172 | 
  173 | function assertExpectedFields(   // assertion function to validate that the expected fields (buyer name and project name) are correctly parsed and included in the response message, iterating through the expected fields and checking that they are present in the message in a case-insensitive manner
  174 |   body: MicrositeResponseBody,
  175 |   fields?: ExpectedFields
  176 | ) {
  177 | 
  178 |   if (!fields) return;   // If no expected fields are provided, skip the validation
  179 | 
  180 |   const message =
  181 |     body.message.toLowerCase(); // Convert the response message to lowercase for case-insensitive comparison
  182 | 
  183 |   for (
  184 |     const value of
  185 |     Object.values(fields)   // Iterate through the values of the expected fields (buyer name and project name) and check if they are present in the response message, ensuring that the microsite generation logic correctly extracts and includes these details in the response
  186 |   ) {
  187 | 
  188 |     if (value) {
  189 | 
  190 |       expect(message)
> 191 |         .toContain(
      |          ^ Error: expect(received).toContain(expected) // indexOf
  192 |           value.toLowerCase()
  193 |         );
  194 | 
  195 |     }
  196 | 
  197 |   }
  198 | 
  199 | }
  200 | 
  201 | // ======================================================
  202 | // POSITIVE TEST CASES
  203 | // ======================================================
  204 | 
  205 | const positiveCases:
  206 |   PositiveCase[] = [
  207 | 
  208 |   {
  209 |     name: 'Valid Input',
  210 |     body:
  211 |       `Harsha with ID ${TEST_BUYER_ID} for Abhee`,
  212 |     expectedFields: {
  213 |       buyerName: 'Harsha',
  214 |       projectName:
  215 |         'Abhee'
  216 |     }
  217 |   },
  218 | 
  219 |   {    
  220 |     name: 'ALL CAPS Input',
  221 |     body:
  222 |       `HARSHA WITH ID ${TEST_BUYER_ID} FOR Abhee`,
  223 |     expectedFields: {
  224 |       buyerName: 'Harsha',
  225 |       projectName:
  226 |         'Abhee'
  227 |     }
  228 |   },
  229 | 
  230 |   {
  231 |     name: 'Mixed Case Input',
  232 |     body:
  233 |       `HaRsHa WiTh Id ${TEST_BUYER_ID} FoR Abhee`,
  234 |     expectedFields: {
  235 |       buyerName: 'Harsha',
  236 |       projectName:
  237 |         'Abhee'
  238 |     }
  239 |   },
  240 | 
  241 |   {
  242 |     name: 'RNR Status',
  243 |     body:
  244 |       `Harsha with ID ${TEST_BUYER_ID} for Abhee RNR`,
  245 |     validateRNR: true,
  246 |     expectedFields: {
  247 |       buyerName: 'Harsha',
  248 |       projectName:
  249 |         'Abhee'
  250 |     }
  251 |   },
  252 | 
  253 |   {
  254 |     name: 'RNR mixed case',
  255 |     body:
  256 |       `Harsha with ID ${TEST_BUYER_ID} for Abhee rNr`,
  257 |     validateRNR: true,
  258 |     expectedFields: {
  259 |       buyerName: 'Harsha',
  260 |       projectName:
  261 |         'Abhee'
  262 |     }
  263 |   },
  264 | 
  265 |   {
  266 |     name: 'Mr Prefix',
  267 |     body:
  268 |       `Mr Harsha with ID ${TEST_BUYER_ID} for Abhee`,
  269 |     expectedFields: {
  270 |       buyerName: 'Harsha',
  271 |       projectName:
  272 |         'Abhee'
  273 |     }
  274 |   },
  275 | 
  276 |   {
  277 |     name: 'Dr Prefix',
  278 |     body:
  279 |       `Dr Harsha with ID ${TEST_BUYER_ID} for Abhee`,
  280 |     expectedFields: {
  281 |       buyerName: 'Harsha',
  282 |       projectName:
  283 |         'Abhee'
  284 |     }
  285 |   },
  286 | 
  287 |   {
  288 |     name: 'Shri Prefix',
  289 |     body:
  290 |       `Shri Harsha with ID ${TEST_BUYER_ID} for Abhee`,
  291 |     expectedFields: {
```