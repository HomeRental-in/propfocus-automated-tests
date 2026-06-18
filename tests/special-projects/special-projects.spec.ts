import { test } from '@playwright/test';
import {
  getAmbiguousTestProjects,
  getBossTestProjects,
  getInactiveTestProjects,
  getPermissionDeniedTestProjects,
  getPhasedAliasTestCases,
  getPhasedSuccessTestProjects,
} from '../../utils/micrositeProjects';
import {
  assertMicrositeByOutcome,
  assertMicrositeSuccess,
  assertSiteVisitByMicrositeOutcome,
  assertSiteVisitFailure,
  assertSiteVisitSuccess,
  bookSiteVisit,
  ensureMicrosite,
  sendWebhook,
  uniqueBuyerId,
  buildMicrositePrompt,
} from '../../utils/specialProjectHelpers';

// ======================================================
// SPECIAL PROJECT CATEGORIES
//
// Boss, phased (explicit + alias), inactive, permission denied,
// and ambiguous phased — for both microsite and site visit flows.
// ======================================================

const BUYER_NAME = 'Harsha';

// ======================================================
// 1. BOSS PROJECTS — microsite
// ======================================================

test.describe('Special projects — boss microsites', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getBossTestProjects()) {
    test(
      `SPEC_BOSS_MS - ${project.name} @sanity`,
      async ({ request }) => {
        const body = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), project.name)
        );
        assertMicrositeSuccess(body);
      }
    );
  }
});

// ======================================================
// 2. BOSS PROJECTS — site visit (microsite first)
// ======================================================

test.describe('Special projects — boss site visits', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getBossTestProjects()) {
    test(
      `SPEC_BOSS_SV - ${project.name} @regression`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        await ensureMicrosite(request, BUYER_NAME, buyerId, project.name);

        const body = await bookSiteVisit(
          request,
          BUYER_NAME,
          buyerId,
          project.name,
          { allowNon200: true }
        );

        // Dev currently rejects boss-project site visits.
        assertSiteVisitFailure(body);
      }
    );
  }
});

// ======================================================
// 3. INACTIVE PROJECTS — microsite
// ======================================================

test.describe('Special projects — inactive microsites', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getInactiveTestProjects()) {
    test(
      `SPEC_INACTIVE_MS - ${project.name} @regression`,
      async ({ request }) => {
        const body = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), project.name)
        );
        assertMicrositeByOutcome(
          body,
          project.expectedOutcome ?? 'inactive'
        );
      }
    );

    for (const alias of project.aliases ?? []) {
      test(
        `SPEC_INACTIVE_MS_ALIAS - "${alias}" (${project.name}) @regression`,
        async ({ request }) => {
          const body = await sendWebhook(
            request,
            buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), alias)
          );
          assertMicrositeByOutcome(
            body,
            project.expectedOutcome ?? 'inactive'
          );
        }
      );
    }
  }
});

// ======================================================
// 4. INACTIVE PROJECTS — site visit
// ======================================================

test.describe('Special projects — inactive site visits', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getInactiveTestProjects()) {
    test(
      `SPEC_INACTIVE_SV - ${project.name} @regression`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const ms = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, buyerId, project.name)
        );

        const outcome = project.expectedOutcome ?? 'inactive';

        if (!ms.micrositeUrl) {
          const sv = await bookSiteVisit(
            request,
            BUYER_NAME,
            buyerId,
            project.name
          );
          assertSiteVisitByMicrositeOutcome(sv, outcome);
          return;
        }

        const sv = await bookSiteVisit(
          request,
          BUYER_NAME,
          buyerId,
          project.name
        );
        assertSiteVisitByMicrositeOutcome(sv, outcome);
      }
    );
  }
});

// ======================================================
// 5. PHASED — explicit phase names
// ======================================================

test.describe('Special projects — phased microsites', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getPhasedSuccessTestProjects()) {
    test(
      `SPEC_PHASED_MS - ${project.name} @sanity`,
      async ({ request }) => {
        const body = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), project.name)
        );
        assertMicrositeSuccess(body);
      }
    );
  }
});

test.describe('Special projects — phased site visits', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getPhasedSuccessTestProjects()) {
    test(
      `SPEC_PHASED_SV - ${project.name} @sanity`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        await ensureMicrosite(request, BUYER_NAME, buyerId, project.name);

        const body = await bookSiteVisit(
          request,
          BUYER_NAME,
          buyerId,
          project.name
        );
        assertSiteVisitSuccess(body);
      }
    );
  }
});

// ======================================================
// 6. PHASED — alias resolution (short name → phase)
// ======================================================

test.describe('Special projects — phased alias microsites', () => {
  test.describe.configure({ mode: 'serial' });

  for (const testCase of getPhasedAliasTestCases()) {
    test(
      `SPEC_PHASED_ALIAS_MS - "${testCase.alias}" → ${testCase.resolvesTo} @regression`,
      async ({ request }) => {
        const body = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), testCase.alias)
        );
        assertMicrositeSuccess(body);
      }
    );
  }
});

test.describe('Special projects — phased alias site visits', () => {
  test.describe.configure({ mode: 'serial' });

  for (const testCase of getPhasedAliasTestCases()) {
    test(
      `SPEC_PHASED_ALIAS_SV - "${testCase.alias}" → ${testCase.resolvesTo} @regression`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        await ensureMicrosite(request, BUYER_NAME, buyerId, testCase.alias);

        const body = await bookSiteVisit(
          request,
          BUYER_NAME,
          buyerId,
          testCase.alias
        );
        assertSiteVisitSuccess(body);
      }
    );
  }
});

// ======================================================
// 7. PERMISSION DENIED — microsite + site visit
// ======================================================

test.describe('Special projects — permission denied microsites', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getPermissionDeniedTestProjects()) {
    test(
      `SPEC_PERM_MS - ${project.name} @regression`,
      async ({ request }) => {
        const body = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), project.name)
        );
        assertMicrositeByOutcome(body, 'permission_denied');
      }
    );
  }
});

test.describe('Special projects — permission denied site visits', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getPermissionDeniedTestProjects()) {
    test(
      `SPEC_PERM_SV - ${project.name} @regression`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const ms = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, buyerId, project.name)
        );

        if (ms.micrositeUrl) {
          await ensureMicrosite(request, BUYER_NAME, buyerId, project.name);
        }

        const sv = await bookSiteVisit(
          request,
          BUYER_NAME,
          buyerId,
          project.name
        );
        assertSiteVisitByMicrositeOutcome(sv, 'permission_denied');
      }
    );
  }
});

// ======================================================
// 8. AMBIGUOUS PHASED — no link / no link_token
// ======================================================

test.describe('Special projects — ambiguous phased microsites', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getAmbiguousTestProjects()) {
    test(
      `SPEC_AMBIG_MS - ${project.name} @regression`,
      async ({ request }) => {
        const body = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, uniqueBuyerId(), project.name)
        );
        assertMicrositeByOutcome(body, 'ambiguous');
      }
    );
  }
});

test.describe('Special projects — ambiguous phased site visits', () => {
  test.describe.configure({ mode: 'serial' });

  for (const project of getAmbiguousTestProjects()) {
    test(
      `SPEC_AMBIG_SV - ${project.name} @regression`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const ms = await sendWebhook(
          request,
          buildMicrositePrompt(BUYER_NAME, buyerId, project.name)
        );

        if (ms.micrositeUrl) {
          await ensureMicrosite(request, BUYER_NAME, buyerId, project.name);
        }

        const sv = await bookSiteVisit(
          request,
          BUYER_NAME,
          buyerId,
          project.name
        );
        assertSiteVisitByMicrositeOutcome(sv, 'ambiguous');
      }
    );
  }
});
