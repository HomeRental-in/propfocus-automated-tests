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

function uniqueBuyerId() {                // function to generate a unique buyer ID for each test case, combining a timestamp and a random number to ensure uniqueness across test runs

  const timestamp =
    Date.now().toString().slice(-4);

  const random =
    Math.floor(100 + Math.random() * 900);

  return `${timestamp}${random}`;     // Returns a string in the format "AUTO" followed by the last 4 digits of the current timestamp and a random 3-digit number, ensuring a unique identifier for each test case
}

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
      `Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {    
    name: 'ALL CAPS Input',
    body:
      `HARSHA WITH ID ${uniqueBuyerId()} FOR ABHEE TRANQUILA`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Mixed Case Input',
    body:
      `HaRsHa WiTh Id ${uniqueBuyerId()} FoR AbHeE TrAnQuIlA`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'RNR Status',
    body:
      `Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila RNR`,
    validateRNR: true,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'RNR mixed case',
    body:
      `Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila rNr`,
    validateRNR: true,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Mr Prefix',
    body:
      `Mr Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Dr Prefix',
    body:
      `Dr Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Shri Prefix',
    body:
      `Shri Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Minor Wrong Spelling',
    body:
      `Harsha with ID ${uniqueBuyerId()} for Abhee Tranqula`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Partial Project Name',
    body:
      `Harsha with ID ${uniqueBuyerId()} for Tranquila`,
    expectedFields: {
      projectName:
        'Tranquila'
    }
  },

  {
    name: 'KNS Short Form',
    body:
      `Harsha with ID ${uniqueBuyerId()} for KNS`,
    expectedFields: {
      buyerName: 'Harsha'
    }
  },

  {
    name: 'Multiple Projects',
    body:
      `Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila and KNS Sampada`,
    expectedFields: {
      buyerName: 'Harsha'
    }
  },

  {
    name: 'Multiple Farm Projects',
    body:
      `Harsha with ID ${uniqueBuyerId()} for Samruddhi Farms, Sampada, Samooha`,
    expectedFields: {
      buyerName: 'Harsha'
    }
  },

  {
    name: 'Dash Separator',
    body:
      `Harsha with ID ${uniqueBuyerId()} - Abhee Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Mixed Delimiters',
    body:
      'Harsha - Abhee / Tranquila',
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Emoji Input',
    body:
      `🏠 Harsha with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: 'Harsha',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Apostrophe Name',
    body:
      `O'Brien with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: "O'Brien",
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Accented Characters',
    body:
      `José with ID ${uniqueBuyerId()} for Abhee Tranquila`,
    expectedFields: {
      buyerName: 'José',
      projectName:
        'Abhee Tranquila'
    }
  },

  {
    name: 'Multiple Spaces',
    body:
      `Aakash          Bhatnagar with ID ${uniqueBuyerId()} for Abhee Aria`,
    expectedFields: {
      buyerName:
        'Aakash Bhatnagar',
      projectName:
        'Abhee Aria'
    }
  },

  {
    name: 'Multi-line Input',
    body:
`Rahul Sharma
Abhee Tranquila
KNS Sampada`,
    expectedFields: {
      buyerName:
        'Rahul Sharma',
      projectName:
        'Abhee Tranquila'
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
      `Harsha with ID ${uniqueBuyerId()} for XYZ Project`
  },

  {
    name:
      'Missing Buyer Name',
    body:
      `with ID ${uniqueBuyerId()} for Abhee Tranquila`
  },

  {
    name:
      'Numeric Buyer Name',
    body:
      '12345 for Abhee Tranquila'
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
      'Harsha with ID for Abhee Tranquila'
  },

  {
    name:
      'Invalid Buyer ID',
    body:
      'Harsha with ID @@@ for Abhee Tranquila'
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

      assertSuccess(
        responseBody
      );

      if (
        testData.validateRNR
      ) {

        assertRNR(
          responseBody
        );

      }

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

      assertFailure(
        responseBody
      );

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
      uniqueBuyerId();

    const BODY =
      `Harsha with ID ${buyerId} for Abhee Tranquila`;

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
      uniqueBuyerId();

    const start =
      Date.now();

    const {
      responseBody
    } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee Tranquila`
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
      uniqueBuyerId();

    const {
      responseBody
    } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee Tranquila`,
        PHONE.SUSPENDED
      );

    assertFailure(
      responseBody
    );

  }
);

// ======================================================
// INACTIVE BROKER
// ======================================================

test(
  'Inactive Broker Validation @regression',

  async ({ request }) => {

    const buyerId =
      uniqueBuyerId();

    const {
      responseBody
    } =
      await sendMicrositeRequest(
        request,
        `Harsha with ID ${buyerId} for Abhee Tranquila`,
        PHONE.INACTIVE
      );

    assertFailure(
      responseBody
    );

  }
);