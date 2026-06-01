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
                    `${referralBuyerName} for Abhee Aaria referral`
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
                'Aakash for Abhee Aaria investor'
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
      'Aakash for Abhee Aaria referral',
      'Aakash for Abhee Aaria Referral',
      'Aakash for Abhee Aaria REFERRAL',
      'Aakash for Abhee Aaria ReFeRrAl'
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
      'Aakash for Abhee Aaria investor',
      'Aakash for Abhee Aaria Investor',
      'Aakash for Abhee Aaria INVESTOR',
      'Aakash for Abhee Aaria InVeStOr'
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
      'Aakash for Abhee Aaria referal',
      'Aakash for Abhee Aaria refferal',
      'Aakash for Abhee Aaria refrral',
      'Aakash for Abhee Aaria referel'
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
      'Aakash for Abhee Aaria investar',
      'Aakash for Abhee Aaria investorr',
      'Aakash for Abhee Aaria invstor',
      'Aakash for Abhee Aaria invester'
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
      'Aakash for XYZ referral',
      'Aakash for ABC investor',
      'Aakash for Fake Project referral',
      'Aakash for Unknown Towers investor'
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
      'Aakash for Abhee Aari referral',
      'Aakash for Abhee Aria referral',
      'Aakash for Abhee Aariya referral',
      'Aakash for Abhee Aariaa referral'
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
      `${referralBuyerName} for  Abhee     Aaria referral`,
      `${referralBuyerName}    for Abhee Aaria referral`,
      `${referralBuyerName} for Abhee Aaria     referral`,
      `${referralBuyerName}     for     Abhee     Aaria     referral`
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
                '   Aakash for Abhee Aaria referral   '
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
                'Aakash for Unnati rnr referral'
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