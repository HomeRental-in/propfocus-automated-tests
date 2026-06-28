import {                       //imports the necessary functions and types from the Playwright testing library
  test,                        // test: function to define test cases
  expect,                      // expect: function for assertions/validations
  APIRequestContext            // APIRequestContext: type for making API requests within tests
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const API_URL =                                   // API endpoint for the microsite generation, can be set via environment variable or defaults to a specific URL
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';    // The URL to which the test will send POST requests to trigger microsite generation

const PHONE = {                                  // Object containing phone numbers for different test scenarios, can be set via environment variables or defaults to specific values
  ACTIVE:
    process.env.TEST_PHONE ??                   // Active phone number for testing successful microsite generation
    '9888898888',

  INACTIVE:
    process.env.INACTIVE_BROKER_PHONE ??      // Inactive broker phone number for testing failure scenarios
    '7777777777',
      
  SUSPENDED:
    process.env.SUSPENDED_ORG_PHONE ??      // Suspended organization phone number for testing failure scenarios
    '6666666666',
} as const;

const TEST_BUYER_ID =
  process.env.TEST_BUYER_ID ?? '9101';

// ======================================================
// TYPES
// ======================================================

interface MicrositeResponseBody {           // interface defining the expected structure of the response body from the microsite generation API
  success: boolean;
  imageURL: string | null;
  micrositeUrl: string | null;
  message: string;
  buyerid?: string;
}

interface ExpectedFields {                  // interface defining the expected fields that can be validated in the response message, used for positive test cases to ensure correct parsing of buyer name and project name
  buyerName?: string;
  projectName?: string;
  buyerId?: string;
}

interface PositiveCase {                    // interface defining the structure of a positive test case, including the name of the test case, the message body to be sent in the request, an optional flag to validate RNR status, and optional expected fields for validation in the response
  name: string;
  body: string;
  validateRNR?: boolean;
  expectedFields?: ExpectedFields;
}

interface NegativeCase {                   // interface defining the structure of a negative test case, including the name of the test case and the message body to be sent in the request, which is expected to fail microsite generation
  name: string;
  body: string;
}

// ======================================================
// UNIQUE BUYER ID
// ======================================================

// function TEST_BUYER_ID {                // function to generate a unique buyer ID for each test case, combining a timestamp and a random number to ensure uniqueness across test runs

//   const timestamp =
//     Date.now().toString().slice(-4);

//   const random =
//     Math.floor(100 + Math.random() * 900);

//   return `${timestamp}${random}`;     // Returns a string in the format "AUTO" followed by the last 4 digits of the current timestamp and a random 3-digit number, ensuring a unique identifier for each test case
// }

// ======================================================
// HELPER
// ======================================================

async function sendMicrositeRequest(    // helper function to send a POST request to the microsite generation API with the specified message body and phone number, and returns the response and parsed response body for further assertions in the test cases
  request: APIRequestContext,
  messageBody: string,
  phone: string = PHONE.ACTIVE          // defaults to the active phone number if not specified, allowing for testing different scenarios such as inactive broker or suspended organization by passing the respective phone numbers
): Promise<{                           // The function returns a promise that resolves to an object containing the raw response from the API and the parsed response body, which can be used in assertions to validate the success or failure of microsite generation based on the input message and phone number
  response: Awaited<                   // Awaited is a TypeScript utility type that resolves the type of a promise, ensuring that the response variable has the correct type based on the API request context's post method
    ReturnType<APIRequestContext['post']>
  >;
  responseBody: MicrositeResponseBody;
}> {

  const response = await request.post(  // Sends a POST request to the specified API_URL with a JSON body containing the event type and data, which includes the phone number and message body. This simulates the incoming message that triggers microsite generation in the application.
    API_URL,
    {
      data: {
        event: 'message',
        data: {
          from: phone,
          body: messageBody
        }
      }
    }
  );

  expect(response.status()).toBe(200);

  const responseBody:
    MicrositeResponseBody =
      await response.json();

  console.log(
    `\nPhone      : ${phone}`
  );

  console.log(
    `Request    : ${messageBody}`
  );

  console.log(
    JSON.stringify(
      responseBody,
      null,
      2
    )
  );

  return {
    response,
    responseBody
  };
}

// ======================================================
// ASSERTIONS
// ======================================================

function assertSuccess(          // assertion function to validate that the microsite generation was successful based on the response body, checking that the success flag is true and that a microsite URL is present in the response
  body: MicrositeResponseBody
) {

  expect(body.success)
    .toBe(true);

  expect(body.micrositeUrl)
    .toBeTruthy();

}

function assertFailure(
  body: MicrositeResponseBody
) {

  expect(body.success)
    .not.toBe(true);

  expect(body.micrositeUrl)
    .toBeFalsy();

}

function assertRNR(
  body: MicrositeResponseBody
) {

  expect(
    body.message.toLowerCase()
  ).toContain(
    'tried reaching you'
  );

}

function assertExpectedFields(   // assertion function to validate that the expected fields (buyer name and project name) are correctly parsed and included in the response message, iterating through the expected fields and checking that they are present in the message in a case-insensitive manner
  body: MicrositeResponseBody,
  fields?: ExpectedFields
) {

  if (!fields) return;   // If no expected fields are provided, skip the validation

  const message =
    body.message.toLowerCase(); // Convert the response message to lowercase for case-insensitive comparison

  for (
    const value of
    Object.values(fields)   // Iterate through the values of the expected fields (buyer name and project name) and check if they are present in the response message, ensuring that the microsite generation logic correctly extracts and includes these details in the response
  ) {

    if (value) {

      expect(message)
        .toContain(
          value.toLowerCase()
        );

    }

  }

}

// ======================================================
// POSITIVE TEST CASES
// ======================================================

const positiveCases:
  PositiveCase[] = [

  {
    name: 'Valid Input',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {    
    name: 'ALL CAPS Input',
    body:
      `HARSHA WITH ID ${TEST_BUYER_ID} FOR Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Mixed Case Input',
    body:
      `HaRsHa WiTh Id ${TEST_BUYER_ID} FoR Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'RNR Status',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Abhee RNR`,
    validateRNR: true,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'RNR mixed case',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Abhee rNr`,
    validateRNR: true,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Mr Prefix',
    body:
      `Mr Harsha with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Dr Prefix',
    body:
      `Dr Harsha with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Shri Prefix',
    body:
      `Shri Harsha with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Minor Wrong Spelling',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Abhee Tranqula`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Partial Project Name',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Tranquila`,
    expectedFields: {
      projectName:
        'Abhee'
    }
  },

 {
  name: 'KNS Short Form',
  body: `Harsha with ID ${TEST_BUYER_ID} for KNS`
},

  {
    name: 'Multiple Projects',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Abhee and KNS Sampada`,
    expectedFields: {
      buyerName: 'Harsha'
    }
  },

  {
    name: 'Multiple Farm Projects',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for Samruddhi Farms, Sampada, Samooha`,
    expectedFields: {
      buyerName: 'Harsha'
    }
  },

  {
    name: 'Dash Separator',
    body:
      `Harsha with ID ${TEST_BUYER_ID} - Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Mixed Delimiters',
    body:
      `Harsha ${TEST_BUYER_ID}- Abhee / Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Emoji Input',
    body:
      `🏠 Harsha with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Apostrophe Name',
    body:
      `O'Brien with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: "O'Brien",
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Accented Characters',
    body:
      `José with ID ${TEST_BUYER_ID} for Abhee`,
    expectedFields: {
      buyerName: 'José',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Multiple Spaces',
    body:
      `Aakash          Bhatnagar with ID ${TEST_BUYER_ID} for Abhee Aria`,
    expectedFields: {
      buyerName:
        'Aakash Bhatnagar',
      projectName:
        'Abhee'
    }
  },

  {
    name: 'Multi-line Input',
    body:
`Rahul Sharma ${TEST_BUYER_ID} for
Abhee
KNS Sampada`,
    expectedFields: {
      buyerName:
        'Rahul Sharma',
      projectName:
        'Abhee'
    }
  }

];

// ======================================================
// NEGATIVE TEST CASES
// ======================================================

const negativeCases:
  NegativeCase[] = [

  {
    name:
      'Invalid Project Name',
    body:
      `Harsha with ID ${TEST_BUYER_ID} for XYZ Project`
  },

  {
    name:
      'Missing Buyer Name',
    body:
      `with ID ${TEST_BUYER_ID} for Abhee`
  },

  {
    name:
      'Numeric Buyer Name',
    body:
      '12345 with ID ${TEST_BUYER_ID} for unnati'
  },

  {
    name:
      'Special Characters Only',
    body:
      '@@@ ### $$$'
  },

  {
    name:
      'Incomplete Buyer ID',
    body:
      'Harsha with ID for Abhee'
  },

  {
    name:
      'Invalid Buyer ID',
    body:
      'Harsha with ID @@@ for Abhee'
  }

];

// ======================================================
// POSITIVE TEST EXECUTION
// ======================================================

for (
  const testData
  of positiveCases
) {

  test(
    `Microsite Positive - ${testData.name} @sanity`,

    async ({ request }) => {

      const {
        responseBody
      } =
        await sendMicrositeRequest(
          request,
          testData.body
        );

      assertSuccess(responseBody);

      assertExpectedFields(
        responseBody,
        testData.expectedFields
      );

    }
  );

}

// ======================================================
// NEGATIVE TEST EXECUTION
// ======================================================

for (
  const testData
  of negativeCases
) {

  test(
    `Microsite Negative - ${testData.name} @regression`,

    async ({ request }) => {

      const {
        responseBody
      } =
        await sendMicrositeRequest(
          request,
          testData.body
        );

      if (testData.name === 'Invalid Project Name') {
  expect(responseBody.success).toBe(true);
  expect(responseBody.micrositeUrl).toBeFalsy();
  expect(responseBody.message.toLowerCase())
    .toContain('projects not found');

} else if (testData.name === 'Numeric Buyer Name') {
  expect(responseBody.success).toBe(true);
  expect(responseBody.micrositeUrl).toBeFalsy();
  expect(responseBody.message.toLowerCase())
    .toContain('invalid username format');
} else if (testData.name === 'Special Characters Only') {
  expect(responseBody.success).toBe(true);
  expect(responseBody.micrositeUrl).toBeFalsy();
  expect(responseBody.message.toLowerCase())
    .toContain('clarification');
}
else if (testData.name === 'Incomplete Buyer ID') {
  expect(responseBody.success).toBe(true);
  expect(responseBody.micrositeUrl).toBeFalsy();
  expect(responseBody.message.toLowerCase())
    .toContain('add buyer ids first');
}
else if (testData.name === 'Invalid Buyer ID') {
  expect(responseBody.success).toBe(true);
  expect(responseBody.micrositeUrl).toBeFalsy();
  expect(responseBody.message.toLowerCase())
    .toContain('add buyer ids first');
}

else {
  assertFailure(responseBody);
}

    }
  );

}

// ======================================================
// MICROSITE REUSE FLOW
// ======================================================

test(
  'Microsite Reuse Flow @regression',

  async ({ request }) => {

    const buyerId =
      TEST_BUYER_ID;

    const BODY =
      `Harsha with ID ${buyerId} for Abhee`;

    const first =
      await sendMicrositeRequest(
        request,
        BODY
      );

    const second =
      await sendMicrositeRequest(
        request,
        BODY
      );

    assertSuccess(
      first.responseBody
    );

    assertSuccess(
      second.responseBody
    );

    expect(
      first.responseBody
        .micrositeUrl
    ).toBe(
      second.responseBody
        .micrositeUrl
    );

  }
);

// ======================================================
// PERFORMANCE TEST
// ======================================================

test(
  'Microsite API Performance @performance',

  async ({ request }) => {

    const buyerId =
      TEST_BUYER_ID;

    const start =
      Date.now();

    const {
      responseBody
    } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee`
      );

    const ms =
      Date.now() - start;

    console.log(
      `Response time: ${ms} ms`
    );

    assertSuccess(
      responseBody
    );

    expect(ms)
      .toBeLessThan(5000);

  }
);

// ======================================================
// SUSPENDED ORGANIZATION
// ======================================================

test(
  'Suspended Organization Validation @regression',

  async ({ request }) => {

    const buyerId =
      TEST_BUYER_ID;

    const {
      responseBody
    } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee`,
        PHONE.SUSPENDED
      );

    expect(responseBody.success).toBe(true);
expect(responseBody.micrositeUrl).toBeFalsy();
expect(responseBody.message.toLowerCase())
  .toContain('organization suspended');

  }
);

// ======================================================
// INACTIVE BROKER
// ======================================================

test(
  'Inactive Broker Validation @regression',

  async ({ request }) => {

    const buyerId =
      TEST_BUYER_ID;

    const {
      responseBody
    } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee`,
        PHONE.INACTIVE
      );

    assertFailure(
      responseBody
    );

  }
);

test(
  'UJ8_STEP_22 - Verify Boss And Phased RNR Cases',
  async ({ request }) => {

    const prompts = [

      `Arhan with ID ${TEST_BUYER_ID} for Sumadhura Solace rnr`,
      `Arhan with ID ${TEST_BUYER_ID} for KNS Samooha rnr`,
      `Arhan with ID ${TEST_BUYER_ID} for KNS Ananta rnr`,

      `Arhan with ID ${TEST_BUYER_ID} for Farm Showcase rnr`,
      `Arhan with ID ${TEST_BUYER_ID} for Farm Land Expo rnr`,
      `Arhan with ID ${TEST_BUYER_ID} for All Projects rnr`
    ];

    for (const prompt of prompts) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: PHONE.ACTIVE,
                body: prompt
              }
            }
          }
        );

      expect(response.status()).toBe(200);

      const body =
        await response.json();

      console.log(
        `\nPrompt: ${prompt}`
      );

      console.log(
        JSON.stringify(
          body,
          null,
          2
        )
      );

      expect(
        body.success
      ).toBe(true);
    }
  }
);