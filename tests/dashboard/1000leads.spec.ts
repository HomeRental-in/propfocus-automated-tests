import { test, expect } from '@playwright/test';

const API_URL = 'https://dev.propfocus.in/api/whatsapp-webhook';

const PHONE = '8374095506';
test.setTimeout(15 * 60 * 1000);// Set timeout to 60 seconds for the entire test suite
test('Generate 500 Microsites', async ({ request }) => {

  for (let buyerId = 1; buyerId <= 100; buyerId++) {

    const response = await request.post(API_URL, {
      data: {
        event: 'message',
        data: {
          from: PHONE,
          body: `Arhan with ID ${buyerId} for Abhee`
        }
      }
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    console.log(`Buyer ID: ${buyerId}`);
    console.log(`Success: ${responseBody.success}`);
    console.log(`Microsite: ${responseBody.micrositeUrl}`);
    console.log('Microsite generated successfully!\n');

    // Small delay to avoid flooding the server
    // await new Promise(resolve => setTimeout(resolve, 100)); // remove this line if it errors
  }

});