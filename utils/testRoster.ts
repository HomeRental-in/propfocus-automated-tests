/**
 * Canonical phones the suite logs in as / sends WhatsApp webhooks from.
 *
 * These are created (or reused) by `npm run setup:brokers` /
 * tests/setup/create-dev-brokers.spec.ts. Specs should import from here
 * instead of hardcoding, so a missing .env still hits the provisioned roster.
 *
 * Override any phone via the matching env var.
 */

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export const ROSTER_ORG_NAME = 'Automation Test Org';
export const SUSPENDED_ORG_NAME = 'Automation Suspended Org';

export const ROSTER = {
  owner: env('OWNER_PHONE', '9900000001'),
  gm: env('GM_PHONE', '9900000002'),
  presalesManager: env('PRESALES_MANAGER_PHONE', '9900000003'),
  salesManager: env('SALES_MANAGER_PHONE', '9900000004'),
  marketingManager: env('MARKETING_MANAGER_PHONE', '9900000005'),
  mainBroker: env('MAIN_BROKER_PHONE', '9999999999'),
  presalesRep: env('PRESALES_REP_PHONE', '9900000011'),
  salesRep: env('SALES_REP_PHONE', '9900000012'),
  marketingRep: env('MARKETING_REP_PHONE', '9900000013'),
  subBroker: env('SUB_BROKER_PHONE', '9888898888'),
  inactive: env('INACTIVE_BROKER_PHONE', '7777777777'),
  suspended: env('SUSPENDED_ORG_PHONE', '6666666666'),
} as const;

export type RosterKey = keyof typeof ROSTER;

/** .env block printed after provisioning so local runs stay in sync. */
export function rosterEnvBlock(): string {
  return [
    `OWNER_PHONE=${ROSTER.owner}`,
    `GM_PHONE=${ROSTER.gm}`,
    `PRESALES_MANAGER_PHONE=${ROSTER.presalesManager}`,
    `SALES_MANAGER_PHONE=${ROSTER.salesManager}`,
    `MARKETING_MANAGER_PHONE=${ROSTER.marketingManager}`,
    `PRESALES_REP_PHONE=${ROSTER.presalesRep}`,
    `SALES_REP_PHONE=${ROSTER.salesRep}`,
    `MARKETING_REP_PHONE=${ROSTER.marketingRep}`,
    `TEST_PHONE=${ROSTER.subBroker}`,
    `MAIN_BROKER_PHONE=${ROSTER.mainBroker}`,
    `SUB_BROKER_PHONE=${ROSTER.subBroker}`,
    `INACTIVE_BROKER_PHONE=${ROSTER.inactive}`,
    `SUSPENDED_ORG_PHONE=${ROSTER.suspended}`,
  ].join('\n');
}
