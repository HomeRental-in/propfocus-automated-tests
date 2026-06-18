import { test, expect } from '@playwright/test';
import { getDefaultTestProject } from '../../utils/micrositeProjects';
import {
  FLAG_AMBIGUITY_CASES,
  FLAG_BOSS_PHASED_PROJECTS,
  MICROSITE_FLAGS,
  MicrositeFlagDefinition,
  buildFlagPrompt,
} from '../../utils/micrositeFlags';
import {
  assertFlagResponse,
  assertLeadVisibleWithTypeFilter,
  generateFlagMicrosite,
  loginDashboard,
  openAllLeads,
  searchLeadInTable,
  sendFlagWebhook,
  uniqueBuyerId,
} from '../../utils/micrositeFlagHelpers';

// ======================================================
// MICROSITE FLAG FLOWS
//
// Tags appended after project name in WhatsApp prompts:
//   rnr | old | old data | data |
//   refer | referral | investor | investment
//
// API: webhook returns micrositeUrl (RNR uses RNR message template).
// Dashboard: lead type filters where applicable.
// ======================================================

const DEFAULT_PROJECT = getDefaultTestProject().name;

// ======================================================
// 1. API — each flag generates a microsite
// ======================================================

test.describe('Microsite flags — API generation', () => {
  test.describe.configure({ mode: 'serial' });

  for (const flag of MICROSITE_FLAGS) {
    test(
      `FLAG_API_${flag.id.toUpperCase()} - ${flag.keyword} @sanity`,
      async ({ request }) => {
        const buyerId = uniqueBuyerId();
        const prompt = buildFlagPrompt(
          flag.buyerPrefix,
          buyerId,
          DEFAULT_PROJECT,
          flag.keyword
        );

        const body = await sendFlagWebhook(request, prompt);
        assertFlagResponse(body, flag.assertType);
      }
    );
  }
});

// ======================================================
// 2. API — case sensitivity per flag
// ======================================================

test.describe('Microsite flags — case sensitivity', () => {
  test.describe.configure({ mode: 'serial' });

  for (const flag of MICROSITE_FLAGS) {
    test(
      `FLAG_CASE_${flag.id.toUpperCase()} - variants @regression`,
      async ({ request }) => {
        for (const variant of flag.caseVariants) {
          const buyerId = uniqueBuyerId();
          const prompt = buildFlagPrompt(
            flag.buyerPrefix,
            buyerId,
            DEFAULT_PROJECT,
            variant
          );

          const body = await sendFlagWebhook(request, prompt);
          assertFlagResponse(body, flag.assertType);

          console.log(`Variant "${variant}" ✓`);
        }
      }
    );
  }
});

// ======================================================
// 3. API — refer ≈ referral, investor ≈ investment
// ======================================================

test.describe('Microsite flags — alias keyword parity', () => {
  test.describe.configure({ mode: 'serial' });

  const aliasPairs: Array<{
    name: string;
    keywords: [string, string];
    assertType: MicrositeFlagDefinition['assertType'];
  }> = [
    { name: 'refer vs referral', keywords: ['refer', 'referral'], assertType: 'link' },
    {
      name: 'investor vs investment',
      keywords: ['investor', 'investment'],
      assertType: 'link',
    },
  ];

  for (const pair of aliasPairs) {
    test(
      `FLAG_ALIAS - ${pair.name} @regression`,
      async ({ request }) => {
        for (const keyword of pair.keywords) {
          const buyerId = uniqueBuyerId();
          const prompt = buildFlagPrompt(
            'FlagAlias',
            buyerId,
            DEFAULT_PROJECT,
            keyword
          );

          const body = await sendFlagWebhook(request, prompt);
          assertFlagResponse(body, pair.assertType);
        }
      }
    );
  }
});

// ======================================================
// 4. API — boss / phased projects per flag
// ======================================================

test.describe('Microsite flags — boss and phased projects', () => {
  test.describe.configure({ mode: 'serial' });

  for (const flag of MICROSITE_FLAGS) {
    for (const project of FLAG_BOSS_PHASED_PROJECTS) {
      test(
        `FLAG_PROJECT_${flag.id.toUpperCase()} - ${project} @regression`,
        async ({ request }) => {
          const buyerId = uniqueBuyerId();
          const prompt = buildFlagPrompt(
            'Arhan',
            buyerId,
            project,
            flag.keyword
          );

          const body = await sendFlagWebhook(request, prompt);
          assertFlagResponse(body, flag.assertType);
        }
      );
    }
  }
});

// ======================================================
// 5. API — ambiguous multi-flag prompts rejected
// ======================================================

test.describe('Microsite flags — ambiguous multi-flag prompts', () => {
  test.describe.configure({ mode: 'serial' });

  for (const testCase of FLAG_AMBIGUITY_CASES) {
    test(
      `FLAG_AMBIG - ${testCase.name} @regression`,
      async ({ request }) => {
        const body = await sendFlagWebhook(
          request,
          testCase.buildBody(uniqueBuyerId())
        );
        assertFlagResponse(body, 'ambiguous');
      }
    );
  }
});

// ======================================================
// 6. API — invalid flag typos still create link (fuzzy)
// ======================================================

test.describe('Microsite flags — invalid keyword typos', () => {
  test.describe.configure({ mode: 'serial' });

  test('FLAG_TYPO_REFERRAL - misspellings @regression', async ({ request }) => {
    const typos = ['referal', 'refferal', 'refrral', 'referel'];

    for (const typo of typos) {
      const body = await sendFlagWebhook(
        request,
        buildFlagPrompt('FlagTypo', uniqueBuyerId(), DEFAULT_PROJECT, typo)
      );
      expect(body.micrositeUrl).toBeTruthy();
    }
  });

  test('FLAG_TYPO_INVESTOR - misspellings @regression', async ({ request }) => {
    const typos = ['investar', 'investorr', 'invstor', 'invester'];

    for (const typo of typos) {
      const body = await sendFlagWebhook(
        request,
        buildFlagPrompt('FlagTypo', uniqueBuyerId(), DEFAULT_PROJECT, typo)
      );
      expect(body.micrositeUrl).toBeTruthy();
    }
  });
});

// ======================================================
// 7. API — spacing, typos, invalid projects
// ======================================================

test.describe('Microsite flags — parser edge cases', () => {
  test.describe.configure({ mode: 'serial' });

  test('FLAG_EDGE_SPACES - extra whitespace @regression', async ({ request }) => {
    const prompts = [
      `FlagSpace with ID ${uniqueBuyerId()} for  Abhee     Tranquila referral`,
      `FlagSpace with ID ${uniqueBuyerId()}    for Abhee Tranquila referral`,
      `FlagSpace with ID ${uniqueBuyerId()} for Abhee Tranquila     referral`,
    ];

    for (const prompt of prompts) {
      const body = await sendFlagWebhook(request, prompt);
      assertFlagResponse(body, 'link');
    }
  });

  test('FLAG_EDGE_LEADING_TRAILING - padded prompt @regression', async ({
    request,
  }) => {
    const body = await sendFlagWebhook(
      request,
      `   FlagPad with ID ${uniqueBuyerId()} for Abhee Tranquila referral   `
    );
    assertFlagResponse(body, 'link');
  });

  test('FLAG_EDGE_PROJECT_TYPO - Abhee Aaria variants @regression', async ({
    request,
  }) => {
    const typos = ['Abhee Aari', 'Abhee Aria', 'Abhee Aariya', 'Abhee Aariaa'];

    for (const project of typos) {
      const body = await sendFlagWebhook(
        request,
        `FlagTypo with ID ${uniqueBuyerId()} for ${project} referral`
      );

      if (body.micrositeUrl) {
        expect(body.success).toBe(true);
        expect(body.message).toMatch(/abhee|aaria/i);
      } else {
        expect(body.message.toLowerCase()).toMatch(/project|clarification|ambiguous/);
      }
    }
  });

  test('FLAG_EDGE_INVALID_PROJECT - unknown project @regression', async ({
    request,
  }) => {
    const prompts = [
      `FlagBad with ID ${uniqueBuyerId()} for XYZ referral`,
      `FlagBad with ID ${uniqueBuyerId()} for ABC investor`,
      `FlagBad with ID ${uniqueBuyerId()} for Fake Project old data`,
    ];

    for (const prompt of prompts) {
      const body = await sendFlagWebhook(request, prompt);
      expect(body.success).toBe(true);

      if (!body.micrositeUrl) {
        expect(body.message.toLowerCase()).toMatch(
          /project|clarification|ambiguous|not found/
        );
      }
    }
  });

  test('FLAG_EDGE_MIXED_REFERRAL_INVESTOR - two buyers @regression', async ({
    request,
  }) => {
    const prompts = [
      'FlagMix for Unnati referral and FlagMix for Abhee Aaria investor',
      'FlagMix for Unnati referral, FlagMix for Abhee Aaria investor',
    ];

    for (const prompt of prompts) {
      const body = await sendFlagWebhook(request, prompt);
      expect(body.success).toBe(true);

      if (body.micrositeUrl) {
        expect(body.message).toMatch(/unnati|aaria/i);
      }
    }
  });
});

// ======================================================
// 8. API — RNR specifics
// ======================================================

test.describe('Microsite flags — RNR behavior', () => {
  test.describe.configure({ mode: 'serial' });

  test('FLAG_RNR_REFERRAL_SINGLE - RNR wins on single project @regression', async ({
    request,
  }) => {
    const body = await sendFlagWebhook(
      request,
      `FlagRnrRef with ID ${uniqueBuyerId()} for Abhee Tranquila rnr referral`
    );

    expect(body.success).toBe(true);
    expect(body.micrositeUrl).toBeTruthy();
    expect(body.message.toLowerCase()).toMatch(
      /tried reaching you|tried reaching out|couldn't connect/i
    );
  });

  test('FLAG_RNR_MULTI - two projects @regression', async ({ request }) => {
    const buyerId = uniqueBuyerId();
    const body = await sendFlagWebhook(
      request,
      `Arhan with ID ${buyerId} for KNS Sampada and Abhee Aaria RNR`
    );

    expect(body.success).toBe(true);

    // Dev may return a link or ask for project clarification when two projects + RNR.
    if (body.micrositeUrl) {
      expect(body.message.toLowerCase()).toMatch(
        /tried reaching you|tried reaching out|couldn't connect/i
      );
      expect(body.message).toMatch(/sampada|aaria/i);
    } else {
      expect(body.message.toLowerCase()).toMatch(
        /ambiguous|clarification|no projects/i
      );
    }
  });

  test('FLAG_RNR_SENTENCE - keyword in sentence @regression', async ({
    request,
  }) => {
    const body = await sendFlagWebhook(
      request,
      `Arhan with ID ${uniqueBuyerId()} for KNS Sampada. This is an rnr lead`
    );

    expect(body.success).toBe(true);
    expect(body.message.toLowerCase()).toMatch(
      /tried reaching you|tried reaching out|couldn't connect/i
    );
  });

  test('FLAG_RNR_NO_ID - works without buyer ID @regression', async ({
    request,
  }) => {
    const body = await sendFlagWebhook(
      request,
      'Arhan for KNS Sampada RNR'
    );

    expect(body.success).toBe(true);
    expect(body.message.toLowerCase()).toMatch(
      /tried reaching you|tried reaching out|couldn't connect/i
    );
  });
});

// ======================================================
// 9. API — old / old data / data tag placement
// ======================================================

test.describe('Microsite flags — old and data tag placement', () => {
  test.describe.configure({ mode: 'serial' });

  const placements = [
    {
      name: 'suffix old',
      build: (id: string) =>
        `FlagOldPlace with ID ${id} for Abhee Tranquila old`,
    },
    {
      name: 'suffix old data',
      build: (id: string) =>
        `FlagOldDataPlace with ID ${id} for Abhee Tranquila old data`,
    },
    {
      name: 'suffix data',
      build: (id: string) =>
        `FlagDataPlace with ID ${id} for Abhee Tranquila data`,
    },
    {
      name: 'old before project',
      build: (id: string) =>
        `FlagOldPre with ID ${id} old for Abhee Tranquila`,
    },
  ];

  for (const placement of placements) {
    test(
      `FLAG_OLD_DATA - ${placement.name} @regression`,
      async ({ request }) => {
        const body = await sendFlagWebhook(
          request,
          placement.build(uniqueBuyerId())
        );
        assertFlagResponse(body, 'link');
      }
    );
  }
});

// ======================================================
// 10. DASHBOARD — generate + verify lead type filters
// ======================================================

test.describe.serial('Microsite flags — dashboard lead types', () => {
  const flagsWithDashboardFilter = MICROSITE_FLAGS.filter(
    (f) => f.dashboardLeadType
  );

  for (const flag of flagsWithDashboardFilter) {
    test(
      `FLAG_DASH_${flag.id.toUpperCase()} - appears under ${flag.dashboardLeadType} @sanity`,
      async ({ request, page }) => {
        const buyerId = uniqueBuyerId();
        const buyerName = `${flag.buyerPrefix}${buyerId}`;

        await generateFlagMicrosite(
          request,
          { ...flag, buyerPrefix: buyerName },
          DEFAULT_PROJECT,
          buyerName,
          buyerId
        );

        await assertLeadVisibleWithTypeFilter(
          page,
          buyerName,
          flag.dashboardLeadType!
        );

        console.log(`${flag.keyword} → ${flag.dashboardLeadType} verified ✓`);
      }
    );
  }
});

// ======================================================
// 11. DASHBOARD — old / data leads appear in All Leads
// ======================================================

test.describe.serial('Microsite flags — dashboard old and data leads', () => {
  const flagsWithoutFilter = MICROSITE_FLAGS.filter(
    (f) => !f.dashboardLeadType
  );

  for (const flag of flagsWithoutFilter) {
    test(
      `FLAG_DASH_${flag.id.toUpperCase()} - appears in All Leads @sanity`,
      async ({ request, page }) => {
        const buyerId = uniqueBuyerId();
        const buyerName = `${flag.buyerPrefix}${buyerId}`;

        await generateFlagMicrosite(
          request,
          { ...flag, buyerPrefix: buyerName },
          DEFAULT_PROJECT,
          buyerName,
          buyerId
        );

        await loginDashboard(page);
        await openAllLeads(page);
        await searchLeadInTable(page, buyerName);

        await expect(page.locator('table')).toContainText(buyerName);

        console.log(`${flag.keyword} lead visible in All Leads ✓`);
      }
    );
  }
});
