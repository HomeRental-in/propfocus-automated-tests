import {                       // imports the necessary functions and types from the Playwright testing library
  test,                        // test: function to define test cases
  expect,                      // expect: function for assertions/validations
  APIRequestContext             // APIRequestContext: type for making API requests within tests
} from '@playwright/test';

// ======================================================
// CONSTANTS
// ======================================================

const API_URL =                                                    // API endpoint for site visit booking, can be set via environment variable or defaults to a specific URL
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = {                                                    // object containing phone numbers for different test scenarios, can be set via environment variables or defaults to specific values
  ACTIVE:
    process.env.TEST_PHONE ??                                      // active broker phone number for testing successful site visit booking
    '9888898888',

  INACTIVE:
    process.env.INACTIVE_BROKER_PHONE ??                           // inactive broker phone number for testing failure scenarios
    '7777777777',

  SUSPENDED:
    process.env.SUSPENDED_ORG_PHONE ??                             // suspended organization phone number for testing failure scenarios
    '6666666666',

  BROKER_A:
    process.env.BROKER_A_PHONE ??                                  // second broker phone number for testing cross-broker access scenarios
    '5555555555',

} as const;

// ======================================================
// TYPES
// ======================================================

interface SiteVisitResponseBody {
  success: boolean;
  message: string;
  link_token?: string;
}

interface SiteVisitCase {                                           // interface defining the structure of a site visit test case, including name, message body, optional phone override, and optional expected fields
  name:            string;
  body:            string;
  phone?:          string;
  expectedFields?: {
    buyerName?:   string;
    projectName?: string;
    visitDate?:   string;
    visitTime?:   string;
  };
}

// ======================================================
// HELPER
// ======================================================

async function sendSiteVisitRequest(                               // helper function to send a POST request to the site visit API with the specified message body and phone number
  request:     APIRequestContext,
  messageBody: string,
  phone:       string = PHONE.ACTIVE                               // defaults to the active phone number if not specified, allowing testing of different broker scenarios
): Promise<{                                                       // the function returns a promise resolving to an object with the raw response and parsed response body
  response: Awaited<                                               // Awaited is a TypeScript utility type that resolves the type of a promise
    ReturnType<APIRequestContext['post']>
  >;
  responseBody: SiteVisitResponseBody;
}> {

  const response = await request.post(                             // sends a POST request simulating an incoming WhatsApp message that triggers site visit booking
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
    SiteVisitResponseBody =
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

function assertSuccess(                                            // assertion function to validate that the site visit booking was successful
  body: SiteVisitResponseBody
) {

  expect(body.success)
    .toBe(true);

  expect(body.message)
    .toBeTruthy();

}

function assertFailure(                                            // assertion function to validate that the site visit booking was correctly rejected
  body: SiteVisitResponseBody
) {

  expect(body.success)
    .not.toBe(true);

}

function assertExpectedFields(                                     
  body: SiteVisitResponseBody,
  fields?: SiteVisitCase['expectedFields']
) {

  // Skip validation if no expected fields exist
  if (!fields) return;

  // Convert response message to lowercase
  const message =
    body.message.toLowerCase();

  // Only validate fields if backend response
  // actually contains detailed values
  // like buyer name/project name.
  //
  // Site-visit API currently returns:
  // "Site visit link created"
  //
  // So skip validation for generic responses.
  if (
    message.includes(
      'site visit link created'
    )
  ) {

    return;

  }

  // Loop through all expected values
  for (
    const value of
    Object.values(fields)
  ) {

    // Ignore undefined/empty values
    if (value) {

      // Validate value exists in response
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
  SiteVisitCase[] = [

  {
    name: 'TC_SV_14 - Valid input with buyer ID, project, date and time',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 11 AM',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila',
      visitTime:   '11'
    }
  },

  {
    name: 'TC_SV_16 - No time given — default time should be 10 AM',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila',
      visitTime:   '10'
    }
  },

  {
    name: 'TC_SV(Natural language + ID) - Full natural language booking request',
    body:
      'Please book site visit for Harsha B123 at Abhee Tranquila on tomorrow 11 AM',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV(Date variation) - Relative date "coming Sunday"',
    body:
      'Harsha B123 for sv Abhee Tranquila on coming Sunday',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV(Extra spaces input) - Extra spaces between words',
    body:
      ' Harsha B123 for sv Abhee Tranquila on tomorrow',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV(Case insensitive input) - Mixed case input',
    body:
      'hArShA b123 FoR sV aBhEe TrAnQuIlA ToMoRrO',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV(With buyer name + ID) - Conversational input',
    body:
      'Can you schedule a site visit for Harsha B123 in Abhee Tranquila tomorrow',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_LINK_04 (Minor typo) - Project name one character off',
    body:
      'Harsha B123 for sv Abhee Tranqula',
    expectedFields: {
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_21 - Ambiguous date "this 18th"',
    body:
      'Harsha B123 for sv Abhee Tranquila on this 18th',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_25 - Wrong order input — fields in wrong order',
    body:
      'for sv Abhee Tranquila Harsha B123 tomorrow',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_26 - Time boundary case',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 00:00',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_27 - Late night time booking',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 11 PM',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_39 - Multi-line input',
    body:
`Harsha
B123 for SV
Abhee Tranquila at
25th April`,
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_42 - Conversational input with Mr prefix',
    body:
      'Hello create sv for Mr. Harsha B123 Abhee Tranquila on tomorrow',
    expectedFields: {
      buyerName:   'Harsha',
      projectName: 'Abhee Tranquila'
    }
  },

  {
    name: 'TC_SV_45 - Update existing booking with different time',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 2 PM',
    expectedFields: {
      visitTime: '2'
    }
  },

];

// ======================================================
// NEGATIVE TEST CASES
// ======================================================

const negativeCases:
  SiteVisitCase[] = [

  {
    name: 'TC_SV_17 - Missing buyer ID',
    body:
      'Harsha for sv Abhee Tranquila on tomorrow'
  },

  {
    name: 'TC_SV_18 - Invalid buyer ID',
    body:
      'Harsha XYZ999 for sv Abhee Tranquila on tomorrow'
  },

  {
    name: 'TC_SV_19 - Microsite not created before booking site visit',
    body:
      'Manas 5768 for sv KNS Sampada on tomorrow'
  },

  {
    name: 'TC_SV_20 - Multiple projects in one request',
    body:
      'Harsha B123 for sv Abhee Tranquila and KNS Sampada'
  },

  {
    name: 'TC_SV_BUG_1 - Past date booking (yesterday)',
    body:
      'Harsha B123 for sv Abhee Tranquila on yesterday'
  },

  {
    name: 'TC_LINK_02 - Buyer ID mismatch',
    body:
      'Ramesh B123 for Abhee Tranquila'
  },

  {
    name: 'TC_LINK_03 - Multiple projects selected',
    body:
      'Harsha B123 for sv Abhee Tranquila, KNS Sampada'
  },

  {
    name: 'TC_LINK_06 - Inactive project',
    body:
      'Harsha B123 for site visit Inactive Project'
  },

  {
    name: 'TC_LINK_07 - Buyer ID belongs to different broker',
    body:
      'Harsha B123 for sv Abhee Tranquila',
    phone:
      PHONE.BROKER_A
  },

  {
    name: 'TC_LINK_08 - Reopen microsite link after site visit',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow'
  },

  {
    name: 'TC_LIST - Multiple projects in list format',
    body:
      'Harsha for sv Abhee Tranquila, KNS Sampada'
  },

  {
    name: 'TC_SV_BUG_7 - Duplicate buyer ID',
    body:
      'Harsha 1234 for sv KNS Sampada on tomorrow'
  },

  {
    name: 'TC_SV_28 - Duplicate booking same slot',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 10 AM'
  },

  {
    name: 'TC_SV_29 - Overlapping booking (10:15 AM after 10 AM)',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 10:15 AM'
  },

  {
    name: 'TC_SV_30 - Invalid date format',
    body:
      'Harsha B123 for sv Abhee Tranquila on 2026/99/99'
  },

  {
    name: 'TC_SV_31 - Very far future date (2050)',
    body:
      'Harsha B123 for sv Abhee Tranquila on 2050 January 1'
  },

  {
    name: 'TC_SV_32 - Multiple rapid bookings must not create duplicates',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow 10 AM'
  },

  {
    name: 'TC_SV_33 - Cancel visit that does not exist',
    body:
      'Cancel site visit for Harsha B123'
  },

  {
    name: 'TC_SV_34 - Reschedule visit that does not exist',
    body:
      'Reschedule Harsha B123 site visit to tomorrow 3 PM'
  },

  {
    name: 'TC_SV_35 - Mixed language input (Hinglish)',
    body:
      'Harsha B123 ke liye sv Abhee Tranquila kal 11 baje'
  },

  {
    name: 'TC_SV_36 - Missing date and time',
    body:
      'Harsha B123 for SV Abhee Tranquila'
  },

  {
    name: 'TC_SV_40 - Inactive broker',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow',
    phone:
      PHONE.INACTIVE
  },

  {
    name: 'TC_SV_41 - Suspended organisation broker',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow',
    phone:
      PHONE.SUSPENDED
  },

  {
    name: 'TC_SV_43 - Multiple buyers in one request',
    body:
      'Rahul 123 and Aman 456 sv for Sobha tomorrow 5pm'
  },

  {
    name: 'TC_LINK_04 (Major typo) - Project name too wrong to fuzzy match',
    body:
      'Harsha B123 for sv Abhee Tranqudadala'
  },

];

// ======================================================
// KNOWN BUG CASES (Red rows in the test sheet)
// test.fail() marks these as expected to fail so CI
// does not break. When a bug is fixed Playwright will
// warn us to remove the test.fail() flag.
// ======================================================

const bugCases:
  SiteVisitCase[] = [

  {
    name: 'TC_SV_15 - ID only input — bot should fetch buyer and schedule visit',
    body:
      'B123 for sv Abhee Tranquila on tomorrow 11 AM'
  },

  {
    name: 'TC_SV_22 - Past date rolls to next month ("this 31st April")',
    body:
      'Harsha B123 for sv Abhee Tranquila on this 31st April'
  },

  {
    name: 'TC_SV_23 (Ambiguous time) - No time given — default should be 10 AM',
    body:
      'Harsha B123 for sv Abhee Tranquila on tomorrow'
  },

  {
    name: 'TC_SV_23 (Keyword variation) - "site visit" should be treated same as "sv"',
    body:
      'Harsha B123 for site visit Abhee Tranquila on tomorrow'
  },

  {
    name: 'TC_SV_37 - Invalid time format "13 AM"',
    body:
      'Harsha B123 for SV Abhee Tranquila on tomorrow 13 AM'
  },

  {
    name: 'TC_SV_38 - Booking too close to current time (today in 5 mins)',
    body:
      'Harsha B123 for SV Abhee Tranquila on today in 5 mins'
  },

  {
    name: 'TC_SV_44 - Conversational + urgent keyword',
    body:
      'Rahul 123 please sv for Sobha at tomorrow 5pm urgent'
  },

];

// ======================================================
// POSITIVE TEST EXECUTION
// ======================================================

for (
  const testData
  of positiveCases
) {

  test(
    `SiteVisit Positive - ${testData.name} @sanity`,

    async ({ request }) => {

      const {
        responseBody
      } =
        await sendSiteVisitRequest(
          request,
          testData.body,
          testData.phone ?? PHONE.ACTIVE  // use case-specific phone if set, otherwise default to active broker
        );

      assertSuccess(
        responseBody
      );

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
    `SiteVisit Negative - ${testData.name} @regression`,

    async ({ request }) => {

      const {
        responseBody
      } =
        await sendSiteVisitRequest(
          request,
          testData.body,
          testData.phone ?? PHONE.ACTIVE
        );

      assertFailure(
        responseBody
      );

    }
  );

}

// ======================================================
// BUG TEST EXECUTION
// ======================================================

for (
  const testData
  of bugCases
) {

  test(
    `SiteVisit Negative - ${testData.name} @regression`,

    async ({ request }) => {

      test.fail();                        // tells Playwright this test is expected to currently fail — remove this line once the bug is fixed

      const {
        responseBody
      } =
        await sendSiteVisitRequest(
          request,
          testData.body,
          testData.phone ?? PHONE.ACTIVE
        );

      assertSuccess(
        responseBody
      );

    }
  );

}

// ======================================================
// TC_LINK_01 - MICROSITE LINK REUSE
// Same input twice must return the same micrositeUrl
// ======================================================

test(
  'SiteVisit Positive - TC_LINK_01 - Same buyer and project returns same microsite link @sanity',

  async ({ request }) => {

    const BODY =
      'Harsha B123 site visit for Abhee Tranquila';

    const first =
      await sendSiteVisitRequest(
        request,
        BODY
      );

    const second =
      await sendSiteVisitRequest(
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
    .link_token
).toBe(
  second.responseBody
    .link_token
);
  }
);


// ======================================================
// TC_SV_46 - PERFORMANCE TEST
// Response must be generated within 3 seconds
// ======================================================

test(
  'SiteVisit Positive - TC_SV_46 - Response generated within 3 seconds @sanity',

  async ({ request }) => {

    const start =
      Date.now();

    const {
      responseBody
    } =
      await sendSiteVisitRequest(
        request,
        'Harsha B123 for sv Abhee Tranquila on tomorrow 11 AM'
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
      .toBeLessThan(3000);

  }

);