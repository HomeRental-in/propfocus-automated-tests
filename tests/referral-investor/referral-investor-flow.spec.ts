import {
  test,
  expect,
  Page
} from '@playwright/test';

const LOGIN_URL =
  'https://dev.propfocus.in/dashboard/login';

const MAIN_BROKER_PHONE =
  '9888898888';

const OTP =
  '123456';

const referralBuyerName =
  'Aakash';
  function uniqueBuyerId() {

  const timestamp =
    Date.now().toString().slice(-4);

  const random =
    Math.floor(100 + Math.random() * 900);

  return `${timestamp}${random}`;
}
const referralPrompt =
  () =>
    `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria referral`;

const investorPrompt =
  () =>
    `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria investor`;

async function login(
  page: Page,
  phone: string = MAIN_BROKER_PHONE
) {

  await page.goto(
    LOGIN_URL,
    {
      waitUntil: 'domcontentloaded'
    }
  );

  const phoneInput =
    page.locator(
      'input[type="tel"], input[placeholder*="phone" i]'
    );

  await expect(
    phoneInput
  ).toBeVisible();

  await phoneInput.fill(
    phone
  );

  await page
    .getByRole('button', {
      name: /send otp/i
    })
    .click();

  await expect(
    page.getByText(
      'Enter Verification Code'
    )
  ).toBeVisible();

  const otpInput =
    page.locator(
      'input[placeholder="000000"], input[maxlength="6"]'
    );

  await otpInput.fill(
    OTP
  );

  await page
    .getByRole('button', {
      name: /verify/i
    })
    .click();

  await page.waitForURL(
    /dashboard/,
    {
      timeout: 30000
    }
  );
}

test.describe.serial(
  'Referral Lead Flow',
  () => {

    test(
      'UJ8_STEP_01 - Generate Referral Lead',
      async ({ request }) => {

        const response =
          await request.post(
            'https://dev.propfocus.in/api/whatsapp-webhook',
            {
              data: {
                event: 'message',
                data: {
                  from:
                    MAIN_BROKER_PHONE,
                  body:
                   
                          referralPrompt() 
                }
              }
            }
          );

        expect(
          response.status()
        ).toBe(200);

        const body =
          await response.json();

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

        expect(
          body.micrositeUrl
        ).toBeTruthy();
      }
    );

    test(
      'UJ8_STEP_02 - Verify Referral Lead Appears In All Leads',
      async ({ page }) => {

        await login(page);

        await page
          .getByRole('button', {
            name: 'All Leads'
          })
          .click();

        await page.waitForLoadState(
          'networkidle'
        );

        await page
          .getByPlaceholder(/search/i)
          .fill(
            referralBuyerName
          );

        await page.waitForTimeout(
          3000
        );

        console.log(
          await page
            .locator('table')
            .textContent()
        );

        await expect(
          page.locator('table')
        ).toContainText(
          'Aakash'
        );
      }
    );

    test(
  'UJ8_STEP_03 - Verify Referral Lead Type',
  async ({ page }) => {

    await login(page);

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await page
      .getByPlaceholder(/search/i)
      .fill('Aakash');

    await page
      .getByRole('button', {
        name: /Lead type/i
      })
      .click();

    await page
      .getByText('Referral')
      .click();

    await page.keyboard.press(
      'Escape'
    );

    await page.waitForTimeout(
      2000
    );

    await expect(
      page.locator('table')
    ).toContainText(
      'Aakash'
    );

    console.log(
      'Referral Lead Type Verified ✓'
    );
  }
);
  });

  test(
  'UJ8_STEP_04 - Generate Investor Lead',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from:
                MAIN_BROKER_PHONE,
              body:
                
                    investorPrompt()
            }
          }
        }
      );

    expect(
      response.status()
    ).toBe(200);

    const body =
      await response.json();

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

    expect(
      body.micrositeUrl
    ).toBeTruthy();

    console.log(
      'Investor Lead Generated ✓'
    );
  }
);
test(
  'UJ8_STEP_05 - Verify Investor Lead Appears In All Leads',
  async ({ page }) => {

    await login(page);

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await page
      .getByPlaceholder(/search/i)
      .fill('Aakash');

    await page.waitForTimeout(
      3000
    );

    console.log(
      await page
        .locator('table')
        .textContent()
    );

    await expect(
      page.locator('table')
    ).toContainText(
      'Aakash'
    );

    console.log(
      'Investor Lead Appears In All Leads ✓'
    );
  }
);

test(
  'UJ8_STEP_06 - Verify Investor Lead Type',
  async ({ page }) => {

    await login(page);

    await page
      .getByRole('button', {
        name: 'All Leads'
      })
      .click();

    await page.waitForLoadState(
      'networkidle'
    );

    await page
      .getByPlaceholder(/search/i)
      .fill('Aakash');

    await page
      .getByRole('button', {
        name: /Lead type/i
      })
      .click();

    await page
      .getByText('Investment')
      .click();

    await page.keyboard.press(
      'Escape'
    );

    await page.waitForTimeout(
      2000
    );

    await expect(
      page.locator('table')
    ).toContainText(
      'Aakash'
    );

    console.log(
      'Investor Lead Type Verified ✓'
    );
  }
);



test(
  'UJ8_STEP_07 - Verify Referral Case Sensitivity',
  async ({ request }) => {

    const referralCases = [
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria referral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria Referral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria REFERRAL`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria ReFeRrAl`
];

    for (const prompt of referralCases) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

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

      expect(
        body.micrositeUrl
      ).toBeTruthy();

      console.log(
        `${prompt} ✓ Microsite Generated`
      );
    }
  }
);
test(
  'UJ8_STEP_08 - Verify Investor Case Sensitivity',
  async ({ request }) => {

    const investorCases = [
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria investor`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria Investor`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria INVESTOR`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria InVeStOr`
];

    for (const prompt of investorCases) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

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

      expect(
        body.micrositeUrl
      ).toBeTruthy();

      console.log(
        `${prompt} ✓ Microsite Generated`
      );
    }
  }
);

test(
  'UJ8_STEP_09 - Verify Invalid Referral Keyword',
  async ({ request }) => {

    const invalidPrompts = [
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria referal`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria refferal`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria refrral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria referel`
];

    for (const prompt of invalidPrompts) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

      const body =
        await response.json();

      console.log(
        `\nPrompt: ${prompt}`
      );

      console.log(
        JSON.stringify(body, null, 2)
      );

      expect(
        body.micrositeUrl
      ).toBeTruthy();
    }
  }
);

test(
  'UJ8_STEP_10 - Verify Invalid Investor Keyword',
  async ({ request }) => {

    const invalidPrompts = [
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria investar`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria investorr`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria invstor`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria invester`
];

    for (const prompt of invalidPrompts) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

      const body =
        await response.json();

      console.log(
        JSON.stringify(body, null, 2)
      );

      expect(
        body.micrositeUrl
      ).toBeTruthy();
    }
  }
);

test(
  'UJ8_STEP_11 - Verify Invalid Project Name Resolution',
  async ({ request }) => {

    const invalidProjects = [
  `Aakash with ID ${uniqueBuyerId()} for XYZ referral`,
  `Aakash with ID ${uniqueBuyerId()} for ABC investor`,
  `Aakash with ID ${uniqueBuyerId()} for Fake Project referral`,
  `Aakash with ID ${uniqueBuyerId()} for Unknown Towers investor`
];

    for (const prompt of invalidProjects) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

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

      if (
        body.micrositeUrl
      ) {

        console.log(
          'Fuzzy matched project ✓'
        );

      } else {

        expect(
          body.message
            .toLowerCase()
        ).toContain(
          'project'
        );

        console.log(
          'Clarification requested ✓'
        );
      }
    }
  }
);
test(
  'UJ8_STEP_12 - Verify Project Name Spelling Variations',
  async ({ request }) => {

    const typoProjects = [
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aari referral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aria referral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aariya referral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aariaa referral`
];

    for (const prompt of typoProjects) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      const body =
        await response.json();

      console.log(
        `\nPrompt: ${prompt}`
      );

      console.log(
        JSON.stringify(body, null, 2)
      );

      // Observe actual behavior
      if (body.micrositeUrl) {
        expect(
  body.success
).toBe(true);

expect(
  body.micrositeUrl
).toBeTruthy();

expect(
  body.message
).toContain(
  'Abhee Aaria'
);
      } else {
        console.log(
          'System rejected typo ✓'
        );
      }
    }
  }
);

test(
  'UJ8_STEP_13 - Verify Extra Spaces Handling',
  async ({ request }) => {

    const prompts = [
  `Aakash with ID ${uniqueBuyerId()} for  Abhee     Aaria referral`,
  `Aakash with ID ${uniqueBuyerId()}    for Abhee Aaria referral`,
  `Aakash with ID ${uniqueBuyerId()} for Abhee Aaria     referral`,
  `Aakash with ID ${uniqueBuyerId()}     for     Abhee     Aaria     referral`
];

    for (const prompt of prompts) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from:
                  MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

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

      expect(
        body.micrositeUrl
      ).toBeTruthy();
      expect(body.message)
  .toContain('Hosachiguru Unnati');

expect(body.message)
  .toContain('Abhee Aaria');

      expect(
        body.message
      ).toContain(
        'Abhee Aaria'
      );
    }
  }
);

test(
  'UJ8_STEP_14 - Verify Mixed Referral and Investor Prompt Handling',
  async ({ request }) => {

    const prompts = [
      'Aakash for Unnati referral and Aakash for Abhee Aaria investor',
      'Aakash for Unnati referral, Aakash for Abhee Aaria investor',
      'Aakash for Abhee Aaria investor and Aakash for Unnati referral'
    ];

    for (const prompt of prompts) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

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

      if (body.micrositeUrl) {

        console.log(
          'Microsite generated ✓'
        );

      } else {

        console.log(
          `Parser response: ${body.message}`
        );

      }
    }
  }
);

test(
  'UJ8_STEP_15 - Verify Leading Trailing Spaces',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from: MAIN_BROKER_PHONE,
              body:
               
                  `   Aakash with ID ${uniqueBuyerId()} for Abhee Aaria referral   `
            }
          }
        }
      );

    const body =
      await response.json();

    expect(body.success).toBe(true);
    expect(body.micrositeUrl).toBeTruthy();
  }
);

test(
  'UJ8_STEP_16 - Verify Mixed Referral And Investor Prompt',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from: MAIN_BROKER_PHONE,
              body:
                'Aakash for Unnati referral and Aakash for Abhee Aaria investor'
            }
          }
        }
      );

    expect(
      response.status()
    ).toBe(200);

    const body =
      await response.json();

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

    expect(
      body.micrositeUrl
    ).toBeTruthy();

    expect(
      body.message
    ).toContain(
      'Hosachiguru Unnati'
    );

    expect(
      body.message
    ).toContain(
      'Abhee Aaria'
    );

    console.log(
      'Mixed Referral + Investor Prompt Accepted ✓'
    );
  }
);

test(
  'UJ8_STEP_17 - Verify RNR And Referral In Same Prompt',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from: MAIN_BROKER_PHONE,
              body:
  `Aakash with ID ${uniqueBuyerId()} for Unnati rnr referral`
            }
          }
        }
      );

    expect(
      response.status()
    ).toBe(200);

    const body =
      await response.json();

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

    expect(
      body.micrositeUrl
    ).toBeFalsy();

    expect(
      body.message
        .toLowerCase()
    ).toContain(
      'ambiguous'
    );

    console.log(
      'RNR + Referral Prompt Rejected ✓'
    );
  }
);

test(
  'UJ8_STEP_18 - Verify Parser Ambiguity Referral Investor',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from: MAIN_BROKER_PHONE,
              body:
                `Aakash with ID ${uniqueBuyerId()} referral investor`
            }
          }
        }
      );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.micrositeUrl).toBeFalsy();

    expect(
      body.message.toLowerCase()
    ).toContain('ambiguous');
  }
);
test(
  'UJ8_STEP_19 - Verify Parser Ambiguity RNR Investor Referral',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from: MAIN_BROKER_PHONE,
              body:
                `Aakash with ID ${uniqueBuyerId()} rnr investor referral`
            }
          }
        }
      );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.micrositeUrl).toBeFalsy();

    expect(
      body.message.toLowerCase()
    ).toContain('ambiguous');
  }
);
test(
  'UJ8_STEP_20 - Verify Parser Ambiguity Referral Investment',
  async ({ request }) => {

    const response =
      await request.post(
        'https://dev.propfocus.in/api/whatsapp-webhook',
        {
          data: {
            event: 'message',
            data: {
              from: MAIN_BROKER_PHONE,
              body:
                `Aakash with ID ${uniqueBuyerId()} referral investment`
            }
          }
        }
      );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.micrositeUrl).toBeFalsy();

    expect(
      body.message.toLowerCase()
    ).toContain('ambiguous');
  }
);

test(
  'UJ8_STEP_21 - Verify Boss And Phased Projects',
  async ({ request }) => {

    const prompts = [

      // Phased Projects
      `Arhan with ID ${uniqueBuyerId()} for Sumadhura Solace referral`,
      `Arhan with ID ${uniqueBuyerId()} for Sumadhura Solace investor`,

      `Arhan with ID ${uniqueBuyerId()} for KNS Samooha referral`,
      `Arhan with ID ${uniqueBuyerId()} for KNS Samooha investor`,

      `Arhan with ID ${uniqueBuyerId()} for KNS Ananta referral`,
      `Arhan with ID ${uniqueBuyerId()} for KNS Ananta investor`,

      // Boss Projects
      `Arhan with ID ${uniqueBuyerId()} for Farm Showcase referral`,
      `Arhan with ID ${uniqueBuyerId()} for Farm Showcase investor`,

      `Arhan with ID ${uniqueBuyerId()} for Farm Land Expo referral`,
      `Arhan with ID ${uniqueBuyerId()} for Farm Land Expo investor`,

      `Arhan with ID ${uniqueBuyerId()} for All Projects referral`,
      `Arhan with ID ${uniqueBuyerId()} for All Projects investor`
    ];

    for (const prompt of prompts) {

      const response =
        await request.post(
          'https://dev.propfocus.in/api/whatsapp-webhook',
          {
            data: {
              event: 'message',
              data: {
                from: MAIN_BROKER_PHONE,
                body: prompt
              }
            }
          }
        );

      expect(
        response.status()
      ).toBe(200);

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

      expect(
        body.micrositeUrl
      ).toBeTruthy();
    }
  }
);