import { test, expect } from '@playwright/test';

import {
  postWebhook,
  DEFAULT_PHONE,
  uniqueBuyerId,
  uniqueBuyerName,
  buildPostVisitPrompt,
  assertPostVisitSuccess,
  assertLinkFailure,
} from '../../utils/buyerLinks';
import { TEST_DATA } from '../../utils/personas';
import {
  getSuccessTestProjects,
  getPhasedSuccessTestProjects,
  getPermissionDeniedTestProjects,
} from '../../utils/micrositeProjects';
import { BROKER_PHONE } from '../../utils/brokerPhones';

// Resolve the project token a broker would actually type: prefer first alias, else name.
function projectToken(p: { name: string; aliases?: string[] }): string {
  return p.aliases && p.aliases.length > 0 ? p.aliases[0] : p.name;
}

// ======================================================
// POSITIVE — @sanity
// ======================================================

test('PostVisit Positive - create post-visit for default project @sanity', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildPostVisitPrompt(name, id, TEST_DATA.postVisitProject)
  );

  assertPostVisitSuccess(body);
});

test('PostVisit Positive - same buyer and project reuses the same link @sanity', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();
  const prompt = buildPostVisitPrompt(name, id, TEST_DATA.postVisitProject);

  const first = await postWebhook(request, prompt);
  assertPostVisitSuccess(first);

  const second = await postWebhook(request, prompt);
  assertPostVisitSuccess(second);

  expect(second.reused).toBe(true);
  expect(second.linkToken).toBe(first.linkToken);
});

// ------------------------------------------------------
// Parametrized standalone (non-phased) success projects (~3)
// ------------------------------------------------------

const standaloneSuccessProjects = getSuccessTestProjects()
  .filter((p) => !/phase/i.test(p.name))
  .slice(0, 3);

for (const p of standaloneSuccessProjects) {
  test(`PostVisit Positive - create post-visit for standalone project "${p.name}" @sanity`, async ({ request }) => {
    const name = uniqueBuyerName();
    const id = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildPostVisitPrompt(name, id, projectToken(p))
    );

    assertPostVisitSuccess(body);
  });
}

// ------------------------------------------------------
// Parametrized phased success projects (~2)
// ------------------------------------------------------

const phasedSuccessProjects = getPhasedSuccessTestProjects().slice(0, 2);

for (const p of phasedSuccessProjects) {
  test(`PostVisit Positive - create post-visit for phased project "${p.name}" @sanity`, async ({ request }) => {
    const name = uniqueBuyerName();
    const id = uniqueBuyerId();

    const body = await postWebhook(
      request,
      buildPostVisitPrompt(name, id, projectToken(p))
    );

    assertPostVisitSuccess(body);
  });
}

// ======================================================
// NEGATIVE — @regression
// ======================================================

test('PostVisit Negative - missing buyer id is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  // Raw prompt without a buyer id: "<name> visited <project>".
  const body = await postWebhook(
    request,
    `${name} visited ${TEST_DATA.postVisitProject}`
  );

  assertLinkFailure(body);
});

const permissionDeniedProjects = getPermissionDeniedTestProjects();

test('PostVisit Negative - permission-denied project is rejected @regression', async ({ request }) => {
  const denied = permissionDeniedProjects[0];
  test.skip(!denied, 'No permission-denied project configured in micrositeProjects.ts');

  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildPostVisitPrompt(name, id, projectToken(denied))
  );

  assertLinkFailure(body);
});

test('PostVisit Negative - inactive broker phone is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildPostVisitPrompt(name, id, TEST_DATA.postVisitProject),
    BROKER_PHONE.INACTIVE
  );

  assertLinkFailure(body);
});

test('PostVisit Negative - suspended org phone is rejected @regression', async ({ request }) => {
  const name = uniqueBuyerName();
  const id = uniqueBuyerId();

  const body = await postWebhook(
    request,
    buildPostVisitPrompt(name, id, TEST_DATA.postVisitProject),
    BROKER_PHONE.SUSPENDED
  );

  assertLinkFailure(body);
});
