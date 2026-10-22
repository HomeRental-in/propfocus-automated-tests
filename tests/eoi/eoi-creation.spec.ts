import { test, expect } from '@playwright/test';

import {
  postWebhook,
  uniqueBuyerId,
  uniqueBuyerName,
  buildEoiPrompt,
  assertEoiSuccess,
  assertLinkFailure,
} from '../../utils/buyerLinks';
import { TEST_DATA } from '../../utils/personas';
import { BROKER_PHONE } from '../../utils/brokerPhones';

// A normal project WITHOUT an EOI campaign configured — EOI creation must fail.
const PROJECT_WITHOUT_CAMPAIGN = 'Abhee Tranquila';

// ======================================================
// POSITIVE — @sanity
// ======================================================

test('EOI Positive - create EOI for campaign project @sanity', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildEoiPrompt(name, id, TEST_DATA.eoiProject),
    TEST_DATA.eoiPhone
  );

  assertEoiSuccess(body);

  if (body.priority_number !== undefined) {
    expect(typeof body.priority_number).toBe('number');
  }
});

test('EOI Positive - same buyer and project reuses the same link @sanity', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();
  const prompt = buildEoiPrompt(name, id, TEST_DATA.eoiProject);

  const first = await postWebhook(request, prompt, TEST_DATA.eoiPhone);
  assertEoiSuccess(first);

  const second = await postWebhook(request, prompt, TEST_DATA.eoiPhone);
  assertEoiSuccess(second);

  expect(second.reused).toBe(true);
  expect(second.linkToken).toBe(first.linkToken);
});

// ======================================================
// NEGATIVE — @regression
// ======================================================

test('EOI Negative - project without an EOI campaign is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  // From the EOI org, a project without a campaign fails with
  // "EOI campaign not found". (From other orgs the bot now silently falls
  // back to creating a plain microsite instead of rejecting, so this must
  // run from the EOI org to test the rejection path.)
  const body = await postWebhook(
    request,
    buildEoiPrompt(name, id, PROJECT_WITHOUT_CAMPAIGN),
    TEST_DATA.eoiPhone
  );

  assertLinkFailure(body);
});

test('EOI Negative - missing buyer id is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  // Raw prompt without a buyer id: "<name> for <project> eoi".
  // Single-token names fail with "EOI fields incomplete" as expected; beware
  // that a TWO-word name ("Kiran Rao for ... eoi") is accepted and creates
  // the page, so this must keep using uniqueBuyerName()'s one-token form.
  const body = await postWebhook(
    request,
    `${name} for ${TEST_DATA.eoiProject} eoi`,
    TEST_DATA.eoiPhone
  );

  assertLinkFailure(body);
});

test('EOI Negative - inactive broker phone is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildEoiPrompt(name, id, TEST_DATA.eoiProject),
    BROKER_PHONE.INACTIVE
  );

  assertLinkFailure(body);
});

test('EOI Negative - suspended org phone is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildEoiPrompt(name, id, TEST_DATA.eoiProject),
    BROKER_PHONE.SUSPENDED
  );

  assertLinkFailure(body);
});
