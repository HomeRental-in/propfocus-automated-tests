# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: microsite/microsite-generation.spec.ts >> Microsite Positive - Multi-line Input @sanity
- Location: tests/microsite/microsite-generation.spec.ts:485:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: undefined
```

# Test source

```ts
  45  |   buyerName?: string;
  46  |   projectName?: string;
  47  |   buyerId?: string;
  48  | }
  49  | 
  50  | interface PositiveCase {                    // interface defining the structure of a positive test case, including the name of the test case, the message body to be sent in the request, an optional flag to validate RNR status, and optional expected fields for validation in the response
  51  |   name: string;
  52  |   body: string;
  53  |   validateRNR?: boolean;
  54  |   expectedFields?: ExpectedFields;
  55  | }
  56  | 
  57  | interface NegativeCase {                   // interface defining the structure of a negative test case, including the name of the test case and the message body to be sent in the request, which is expected to fail microsite generation
  58  |   name: string;
  59  |   body: string;
  60  | }
  61  | 
  62  | // ======================================================
  63  | // UNIQUE BUYER ID
  64  | // ======================================================
  65  | 
  66  | // function TEST_BUYER_ID {                // function to generate a unique buyer ID for each test case, combining a timestamp and a random number to ensure uniqueness across test runs
  67  | 
  68  | //   const timestamp =
  69  | //     Date.now().toString().slice(-4);
  70  | 
  71  | //   const random =
  72  | //     Math.floor(100 + Math.random() * 900);
  73  | 
  74  | //   return `${timestamp}${random}`;     // Returns a string in the format "AUTO" followed by the last 4 digits of the current timestamp and a random 3-digit number, ensuring a unique identifier for each test case
  75  | // }
  76  | 
  77  | // ======================================================
  78  | // HELPER
  79  | // ======================================================
  80  | 
  81  | async function sendMicrositeRequest(    // helper function to send a POST request to the microsite generation API with the specified message body and phone number, and returns the response and parsed response body for further assertions in the test cases
  82  |   request: APIRequestContext,
  83  |   messageBody: string,
  84  |   phone: string = PHONE.ACTIVE          // defaults to the active phone number if not specified, allowing for testing different scenarios such as inactive broker or suspended organization by passing the respective phone numbers
  85  | ): Promise<{                           // The function returns a promise that resolves to an object containing the raw response from the API and the parsed response body, which can be used in assertions to validate the success or failure of microsite generation based on the input message and phone number
  86  |   response: Awaited<                   // Awaited is a TypeScript utility type that resolves the type of a promise, ensuring that the response variable has the correct type based on the API request context's post method
  87  |     ReturnType<APIRequestContext['post']>
  88  |   >;
  89  |   responseBody: MicrositeResponseBody;
  90  | }> {
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
> 145 |     .toBeTruthy();
      |      ^ Error: expect(received).toBeTruthy()
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
  191 |         .toContain(
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
```