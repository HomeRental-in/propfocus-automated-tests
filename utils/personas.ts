/**
 * Dashboard personas for permission / scoping tests.
 *
 * Each persona is a real dev broker account, identified by phone (login is
 * phone+OTP). Fill the phone numbers in .env. A persona whose phone is not set
 * is skipped at runtime (test.skip) so the suite stays green until configured.
 *
 * `expect` encodes what /dashboard/broker-profile should report for that account,
 * and `orgWide` whether it should see the whole org's data.
 */

export type OrgRoleLevel =
  | 'organization_owner'
  | 'general_manager'
  | 'manager'
  | 'representative';

export type TeamFunction = 'presales' | 'sales' | 'marketing';

export interface Persona {
  key: string;
  label: string;
  /** env var holding the login phone */
  phoneEnv: string;
  phone: string | undefined;
  expect: {
    orgRoleLevel: OrgRoleLevel;
    teamFunction?: TeamFunction;
    brokerType: 'main' | 'sub';
    /** true => should have org-wide data visibility */
    orgWide: boolean;
  };
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export const PERSONAS: Persona[] = [
  {
    key: 'owner',
    label: 'Organization Owner',
    phoneEnv: 'OWNER_PHONE',
    phone: env('OWNER_PHONE'),
    expect: { orgRoleLevel: 'organization_owner', brokerType: 'main', orgWide: true },
  },
  {
    key: 'gm',
    label: 'General Manager',
    phoneEnv: 'GM_PHONE',
    phone: env('GM_PHONE'),
    expect: { orgRoleLevel: 'general_manager', brokerType: 'main', orgWide: true },
  },
  {
    key: 'presales-manager',
    label: 'Pre-Sales Manager',
    phoneEnv: 'PRESALES_MANAGER_PHONE',
    phone: env('PRESALES_MANAGER_PHONE'),
    expect: {
      orgRoleLevel: 'manager',
      teamFunction: 'presales',
      brokerType: 'main',
      orgWide: false,
    },
  },
  {
    key: 'presales-rep',
    label: 'Pre-Sales Representative',
    phoneEnv: 'PRESALES_REP_PHONE',
    phone: env('PRESALES_REP_PHONE'),
    expect: {
      orgRoleLevel: 'representative',
      teamFunction: 'presales',
      brokerType: 'sub',
      orgWide: false,
    },
  },
  {
    key: 'sales-rep',
    label: 'Sales Representative',
    phoneEnv: 'SALES_REP_PHONE',
    phone: env('SALES_REP_PHONE'),
    expect: {
      orgRoleLevel: 'representative',
      teamFunction: 'sales',
      brokerType: 'sub',
      orgWide: false,
    },
  },
  {
    key: 'marketing-rep',
    label: 'Marketing Representative',
    phoneEnv: 'MARKETING_REP_PHONE',
    phone: env('MARKETING_REP_PHONE'),
    expect: {
      orgRoleLevel: 'representative',
      teamFunction: 'marketing',
      brokerType: 'sub',
      orgWide: false,
    },
  },
];

export const WORKSPACES: TeamFunction[] = ['presales', 'sales', 'marketing'];

/** Projects / buyers used by the new suites. Overridable via .env. */
export const TEST_DATA = {
  /** Accessible standalone project for post-visit / EOI tests. */
  postVisitProject: env('POST_VISIT_PROJECT') ?? 'Abhee Tranquila',
  /** Project that has an EOI campaign configured on dev. */
  eoiProject: env('EOI_PROJECT') ?? 'Unnati',
  /** An accessible phased project (alias form the parser resolves). */
  phasedProject: env('PHASED_PROJECT') ?? 'KNS Samooha',
};
