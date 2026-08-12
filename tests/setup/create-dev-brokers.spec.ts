/**
 * One-time / pre-suite DEV setup: create the test broker roster the suite logs in as.
 *
 * Dashboard specs default to MAIN 9999999999 / SUB 9888898888, and persona suites
 * need owner / GM / managers / reps. None of those are guaranteed on a fresh or
 * reset dev DB (login returns "This phone number is not registered").
 *
 * Organization owners cannot be POSTed to /admin/brokers — they are created from
 * the org's contact_phone. This spec creates the org first, then the rest of the
 * roster, plus an inactive broker and a suspended org.
 *
 * Idempotent: brokers whose phone already exists are reused.
 *
 * Requires admin creds in .env:  ADMIN_EMAIL=...  ADMIN_PASSWORD=...
 * Runs automatically before the suite (playwright "setup" project).
 * Manual:  npm run setup:brokers
 */
import { test, expect } from '@playwright/test';
import { adminLogin, adminCredsConfigured } from '../../utils/adminApi';
import { provisionAutomationBrokers } from '../../utils/provisionBrokers';

test.describe('Dev broker setup', () => {
  test.describe.configure({ mode: 'serial' });

  test('@setup - provision automation broker roster', async ({ request }) => {
    test.skip(
      !adminCredsConfigured(),
      'Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to provision dashboard brokers'
    );
    test.setTimeout(180_000);

    const { token } = await adminLogin(request);
    const { brokers } = await provisionAutomationBrokers(request, token);

    expect(brokers.length, 'expected owner + suspended + roster entries').toBeGreaterThan(5);
    expect(brokers.every((s) => Boolean(s.id))).toBe(true);
  });
});
