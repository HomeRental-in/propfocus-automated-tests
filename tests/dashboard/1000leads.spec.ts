import { test, expect } from '@playwright/test';
import { BROKER_PHONE } from '../../utils/brokerPhones';

const API_URL = 'https://dev.propfocus.in/api/whatsapp-webhook';
const PHONE = BROKER_PHONE.MAIN_BROKER;

test.setTimeout(15 * 60 * 1000);

test('Generate 500 Microsites', async ({ request }) => {
  test.skip(
    !process.env.RUN_SEEDER,
    'Bulk seeder — set RUN_SEEDER=1 to create throwaway microsites. Not part of the default suite.'
  );

  for (let buyerId = 1; buyerId <= 100; buyerId++) {
    const response = await request.post(API_URL, {
      data: {
        event: 'message',
        data: {
          from: PHONE,
          body: `Arhan with ID ${buyerId} for Abhee`,
        },
      },
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();

    console.log(`Buyer ID: ${buyerId}`);
    console.log(`Success: ${responseBody.success}`);
    console.log(`Microsite: ${responseBody.micrositeUrl}`);
    console.log('Microsite generated successfully!\n');
  }
});
