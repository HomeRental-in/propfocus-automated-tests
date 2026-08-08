/**
 * Persona permission / data-scoping coverage for the dashboard API.
 *
 * Personas are real dev broker accounts (login is phone+OTP). Their phone
 * numbers come from .env (see utils/personas.ts); a persona whose phone is not
 * set is skipped so the suite stays green until configured.
 *
 * What we assert:
 *   1. Profile shape per persona — /dashboard/broker-profile must report the
 *      expected orgRoleLevel / brokerType / org-wide access (and teamFunction
 *      when the persona pins one). Persona is NOT in the data responses; it is
 *      only readable from the profile endpoint.
 *   2. Data scoping — an org-wide viewer (owner) sees at least as many
 *      microsites as a representative (self-only scope), so ownerTotal >= repTotal.
 *   3. Workspace filtering — the owner can request each workspace and the
 *      endpoint accepts + scopes it (200 with a numeric pagination.total >= 0).
 *      We avoid brittle exact-count asserts.
 */

import { test, expect } from '@playwright/test';
import { loginBroker, getBrokerProfile, getMicrosites } from '../../utils/dashboardApi';
import { PERSONAS, WORKSPACES } from '../../utils/personas';

// ======================================================
// 1. Per-persona profile shape
// ======================================================

test.describe('Persona profile shape', () => {
  for (const persona of PERSONAS) {
    test(`${persona.label} (${persona.key}) profile matches expectations @sanity`, async ({
      request,
    }) => {
      test.skip(!persona.phone, `set ${persona.phoneEnv} to run this persona`);

      const { token } = await loginBroker(request, persona.phone as string);
      const profile = await getBrokerProfile(request, token);

      console.log(
        `${persona.label}: orgRoleLevel=${profile.orgRoleLevel}, brokerType=${profile.brokerType}, ` +
          `teamFunction=${profile.teamFunction}, hasOrgWideAccess=${profile.hasOrgWideAccess}`
      );

      expect(
        profile.orgRoleLevel,
        `${persona.label} orgRoleLevel mismatch`
      ).toBe(persona.expect.orgRoleLevel);

      expect(
        profile.brokerType,
        `${persona.label} brokerType mismatch`
      ).toBe(persona.expect.brokerType);

      expect(
        profile.hasOrgWideAccess,
        `${persona.label} hasOrgWideAccess mismatch`
      ).toBe(persona.expect.orgWide);

      if (persona.expect.teamFunction) {
        expect(
          profile.teamFunction,
          `${persona.label} teamFunction mismatch`
        ).toBe(persona.expect.teamFunction);
      }
    });
  }
});

// ======================================================
// 2. Data scoping: org-wide owner sees >= a representative
// ======================================================

test.describe('Persona data scoping', () => {
  test('owner microsites total >= representative microsites total @regression', async ({
    request,
  }) => {
    const owner = PERSONAS.find((p) => p.key === 'owner');
    const rep = PERSONAS.find((p) => p.key === 'presales-rep');

    test.skip(
      !owner?.phone || !rep?.phone,
      `set both ${owner?.phoneEnv ?? 'OWNER_PHONE'} and ${rep?.phoneEnv ?? 'PRESALES_REP_PHONE'} to run`
    );

    const ownerSession = await loginBroker(request, owner!.phone as string);
    const repSession = await loginBroker(request, rep!.phone as string);

    const ownerRes = await getMicrosites(request, ownerSession.token);
    const repRes = await getMicrosites(request, repSession.token);

    expect(ownerRes.status, `owner microsites failed: ${JSON.stringify(ownerRes.body)}`).toBe(200);
    expect(repRes.status, `rep microsites failed: ${JSON.stringify(repRes.body)}`).toBe(200);

    const ownerTotal: number = ownerRes.body?.data?.pagination?.total ?? 0;
    const repTotal: number = repRes.body?.data?.pagination?.total ?? 0;

    console.log(`owner microsites total=${ownerTotal}, representative microsites total=${repTotal}`);

    expect(
      ownerTotal,
      `org-wide owner (${ownerTotal}) should see at least as many microsites as ` +
        `a self-scoped representative (${repTotal})`
    ).toBeGreaterThanOrEqual(repTotal);
  });
});

// ======================================================
// 3. Workspace filtering is accepted and scoped
// ======================================================

test.describe('Persona workspace filtering', () => {
  test('owner can query each workspace and gets a scoped 200 @sanity', async ({ request }) => {
    const owner = PERSONAS.find((p) => p.key === 'owner');

    test.skip(!owner?.phone, `set ${owner?.phoneEnv ?? 'OWNER_PHONE'} to run`);

    const { token } = await loginBroker(request, owner!.phone as string);

    for (const workspace of WORKSPACES) {
      const res = await getMicrosites(request, token, { workspace });

      expect(
        res.status,
        `workspace=${workspace} microsites failed: ${JSON.stringify(res.body)}`
      ).toBe(200);

      const total = res.body?.data?.pagination?.total;
      console.log(`workspace=${workspace}: pagination.total=${total}`);

      expect(typeof total, `workspace=${workspace} total should be a number`).toBe('number');
      expect(total, `workspace=${workspace} total should be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });
});
