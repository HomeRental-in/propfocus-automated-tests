/**
 * Idempotent admin-API provisioning for the automation broker roster.
 *
 * Why this exists: dashboard UI specs log in as MAIN (9999999999) / SUB
 * (9888898888) / persona phones. Those accounts are not guaranteed on a
 * fresh or reset dev DB, and POST /admin/brokers cannot create an
 * organization_owner (owners are created from the org's contact_phone).
 *
 * This helper:
 *   1. Creates (or reuses) "Automation Test Org" with contact_phone = owner
 *      so the owner broker is created by the backend.
 *   2. Creates GM / managers / main / reps / sub / inactive in that org.
 *   3. Creates a separate suspended org whose owner phone is the suspended
 *      test number.
 *   4. Reuses any phone that already exists (does not move brokers between orgs).
 */

import { APIRequestContext, expect } from '@playwright/test';
import { adminGet, adminPost, adminPut } from './adminApi';
import {
  ROSTER,
  ROSTER_ORG_NAME,
  SUSPENDED_ORG_NAME,
  rosterEnvBlock,
} from './testRoster';

export const last10 = (p: string) => String(p ?? '').replace(/\D/g, '').slice(-10);

type OrgRoleLevel = 'organization_owner' | 'general_manager' | 'manager' | 'representative';

interface RosterCreateEntry {
  key: string;
  phone: string;
  name: string;
  type: 'main' | 'sub';
  orgRoleLevel: OrgRoleLevel;
  teamFunction?: 'presales' | 'sales' | 'marketing';
  managerFunctions?: Array<'presales' | 'sales' | 'marketing'>;
  parentKey?: string;
  status?: 'active' | 'inactive';
}

/** Brokers created via POST /admin/brokers (owner is created via org contact_phone). */
const CREATE_ROSTER: RosterCreateEntry[] = [
  {
    key: 'gm',
    phone: ROSTER.gm,
    name: 'Automation General Manager',
    type: 'main',
    orgRoleLevel: 'general_manager',
    managerFunctions: ['presales', 'sales', 'marketing'],
  },
  {
    key: 'presalesManager',
    phone: ROSTER.presalesManager,
    name: 'Automation Presales Manager',
    type: 'main',
    orgRoleLevel: 'manager',
    managerFunctions: ['presales'],
  },
  {
    key: 'salesManager',
    phone: ROSTER.salesManager,
    name: 'Automation Sales Manager',
    type: 'main',
    orgRoleLevel: 'manager',
    managerFunctions: ['sales'],
  },
  {
    key: 'marketingManager',
    phone: ROSTER.marketingManager,
    name: 'Automation Marketing Manager',
    type: 'main',
    orgRoleLevel: 'manager',
    managerFunctions: ['marketing'],
  },
  {
    key: 'mainBroker',
    phone: ROSTER.mainBroker,
    name: 'Automation Main Broker',
    type: 'main',
    orgRoleLevel: 'manager',
    managerFunctions: ['presales'],
  },
  {
    key: 'presalesRep',
    phone: ROSTER.presalesRep,
    name: 'Automation Presales Rep',
    type: 'sub',
    orgRoleLevel: 'representative',
    teamFunction: 'presales',
    parentKey: 'presalesManager',
  },
  {
    key: 'salesRep',
    phone: ROSTER.salesRep,
    name: 'Automation Sales Rep',
    type: 'sub',
    orgRoleLevel: 'representative',
    teamFunction: 'sales',
    parentKey: 'salesManager',
  },
  {
    key: 'marketingRep',
    phone: ROSTER.marketingRep,
    name: 'Automation Marketing Rep',
    type: 'sub',
    orgRoleLevel: 'representative',
    teamFunction: 'marketing',
    parentKey: 'marketingManager',
  },
  {
    key: 'subBroker',
    phone: ROSTER.subBroker,
    name: 'Automation Sub Broker',
    type: 'sub',
    orgRoleLevel: 'representative',
    teamFunction: 'presales',
    parentKey: 'presalesManager',
  },
  {
    key: 'inactive',
    phone: ROSTER.inactive,
    name: 'Automation Inactive Broker',
    type: 'main',
    orgRoleLevel: 'manager',
    managerFunctions: ['presales'],
    status: 'inactive',
  },
];

export interface ProvisionedBroker {
  role: string;
  phone: string;
  id: string;
  created: boolean;
}

export interface ProvisionResult {
  orgId: string;
  brokers: ProvisionedBroker[];
}

async function findOrgByName(
  request: APIRequestContext,
  token: string,
  name: string
): Promise<{ id: string; contact_phone?: string } | undefined> {
  const { status, body } = await adminGet(request, token, '/admin/organizations', {
    all: 'true',
  });
  expect(status, `list orgs failed: ${JSON.stringify(body)}`).toBe(200);
  return (body.organizations ?? []).find((o: any) => o.name === name);
}

async function findBrokerByPhone(
  request: APIRequestContext,
  token: string,
  phone: string
): Promise<any | undefined> {
  const { status, body } = await adminGet(request, token, '/admin/brokers', {
    search: last10(phone),
  });
  expect(status, `list brokers failed: ${JSON.stringify(body)}`).toBe(200);
  const needle = last10(phone);
  return (body.brokers ?? []).find((b: any) => last10(b.phone) === needle);
}

async function ensureManagerFunctions(
  request: APIRequestContext,
  token: string,
  broker: any,
  functions: Array<'presales' | 'sales' | 'marketing'>
): Promise<void> {
  if (!broker?.id || broker.org_role_level === 'general_manager') return;
  const { status, body } = await adminPut(request, token, `/admin/brokers/${broker.id}`, {
    name: broker.name,
    phone: last10(broker.phone),
    type: broker.type ?? 'main',
    organization_id: broker.organization_id,
    org_role_level: broker.org_role_level ?? 'manager',
    manager_functions: functions,
    status: broker.status ?? 'active',
  });
  if (status >= 300) {
    console.warn(
      `Could not set manager_functions for ${broker.phone} (${status}): ${JSON.stringify(body)}`
    );
  }
}

async function ensureOrg(
  request: APIRequestContext,
  token: string,
  name: string,
  contactPhone: string,
  status: 'free' | 'suspended' = 'free'
): Promise<string> {
  const existing = await findOrgByName(request, token, name);
  if (existing?.id) {
    console.log(`Org "${name}" exists → ${existing.id}`);
    const alreadyOwner = last10(existing.contact_phone ?? '') === last10(contactPhone);
    if (!alreadyOwner) {
      // Re-PUT contact_phone so ensureOrganizationOwnerBroker runs for a missing owner.
      const payload: Record<string, unknown> = { name, contact_phone: contactPhone };
      if (status === 'suspended') payload.status = status;
      const { status: putStatus, body } = await adminPut(
        request,
        token,
        `/admin/organizations/${existing.id}`,
        payload
      );
      if (putStatus >= 300) {
        console.warn(
          `Could not refresh org "${name}" owner phone (${putStatus}): ${JSON.stringify(body)}`
        );
      }
    }
    return existing.id;
  }

  const { status: createStatus, body } = await adminPost(request, token, '/admin/organizations', {
    name,
    contact_phone: contactPhone,
    status,
    plan: 'free',
  });
  expect(
    createStatus,
    `create org "${name}" failed: ${JSON.stringify(body)}`
  ).toBeLessThan(300);
  const id = body.organization?.id ?? body.data?.id;
  expect(id, `no organization id returned: ${JSON.stringify(body)}`).toBeTruthy();
  console.log(`Org "${name}" created → ${id}`);
  return id;
}

async function createBroker(
  request: APIRequestContext,
  token: string,
  orgId: string,
  entry: RosterCreateEntry,
  idByKey: Record<string, string>
): Promise<string> {
  const data: Record<string, unknown> = {
    name: entry.name,
    phone: entry.phone,
    type: entry.type,
    organization_id: orgId,
    org_role_level: entry.orgRoleLevel,
    status: entry.status ?? 'active',
  };
  if (entry.teamFunction) data.team_function = entry.teamFunction;
  if (entry.managerFunctions) data.manager_functions = entry.managerFunctions;
  if (entry.type === 'sub' && entry.parentKey) {
    const parentId = idByKey[entry.parentKey];
    expect(parentId, `parent ${entry.parentKey} not resolved before creating ${entry.phone}`).toBeTruthy();
    data.main_broker_ids = [parentId];
    data.parent_id = parentId;
  }

  const { status, body } = await adminPost(request, token, '/admin/brokers', data);
  expect(
    status,
    `create broker ${entry.phone} failed: ${JSON.stringify(body)}`
  ).toBeLessThan(300);
  const id = body.broker?.id ?? body.data?.id;
  expect(id, `no broker id returned for ${entry.phone}: ${JSON.stringify(body)}`).toBeTruthy();
  return id;
}

export async function provisionAutomationBrokers(
  request: APIRequestContext,
  token: string
): Promise<ProvisionResult> {
  const orgId = await ensureOrg(request, token, ROSTER_ORG_NAME, ROSTER.owner, 'free');
  await ensureOrg(request, token, SUSPENDED_ORG_NAME, ROSTER.suspended, 'suspended');

  const idByKey: Record<string, string> = {};
  const brokers: ProvisionedBroker[] = [];

  const owner = await findBrokerByPhone(request, token, ROSTER.owner);
  expect(
    owner?.id,
    `Owner broker for ${ROSTER.owner} was not created. Org contact_phone should provision it.`
  ).toBeTruthy();
  idByKey.owner = owner!.id;
  brokers.push({
    role: 'organization_owner',
    phone: ROSTER.owner,
    id: owner!.id,
    created: false,
  });

  const suspended = await findBrokerByPhone(request, token, ROSTER.suspended);
  expect(
    suspended?.id,
    `Suspended-org owner for ${ROSTER.suspended} was not created.`
  ).toBeTruthy();
  brokers.push({
    role: 'suspended-org-owner',
    phone: ROSTER.suspended,
    id: suspended!.id,
    created: false,
  });

  for (const entry of CREATE_ROSTER) {
    const existing = await findBrokerByPhone(request, token, entry.phone);
    let id = existing?.id;
    let created = false;
    if (!id) {
      id = await createBroker(request, token, orgId, entry, idByKey);
      created = true;
    } else {
      console.log(`Broker ${entry.phone} already exists → ${id}`);
    }
    if (entry.managerFunctions) {
      const row = existing ?? (await findBrokerByPhone(request, token, entry.phone));
      if (row) await ensureManagerFunctions(request, token, row, entry.managerFunctions);
    }
    idByKey[entry.key] = id;
    brokers.push({
      role: `${entry.orgRoleLevel}${entry.teamFunction ? `/${entry.teamFunction}` : ''}${
        entry.status === 'inactive' ? ' (inactive)' : ''
      }`,
      phone: entry.phone,
      id,
      created,
    });
  }

  console.log('\n─── Broker roster ───');
  for (const s of brokers) {
    console.log(`  ${s.created ? 'CREATED' : 'exists '}  ${s.phone}  ${s.role}  ${s.id}`);
  }
  console.log('\n─── Paste into .env ───');
  console.log(rosterEnvBlock());
  console.log('─────────────────────\n');

  const orgIds = new Set<string>([orgId]);
  const main = await findBrokerByPhone(request, token, ROSTER.mainBroker);
  const sub = await findBrokerByPhone(request, token, ROSTER.subBroker);
  if (main?.organization_id) orgIds.add(main.organization_id);
  if (sub?.organization_id) orgIds.add(sub.organization_id);
  await grantDefaultProjectsToOrgs(request, token, [...orgIds]);

  return { orgId, brokers };
}

const DEFAULT_ACCESS_PROJECTS = ['Abhee Tranquila', 'KNS Sampada'];

async function grantDefaultProjectsToOrgs(
  request: APIRequestContext,
  token: string,
  orgIds: string[]
): Promise<void> {
  const { status, body } = await adminGet(request, token, '/admin/projects');
  if (status >= 300) {
    console.warn(`Could not list projects to grant org access (${status})`);
    return;
  }
  const projects: any[] = body.projects ?? body.data ?? [];
  for (const name of DEFAULT_ACCESS_PROJECTS) {
    const project = projects.find(
      (p) => String(p.name || '').toLowerCase() === name.toLowerCase()
    );
    if (!project?.id) {
      console.warn(`Project "${name}" not found — skip org access grant`);
      continue;
    }
    if (project.accessible_to_all !== false) {
      console.log(`Project "${name}" is accessible_to_all — no grant needed`);
      continue;
    }
    const listed: string[] = (project.associated_organizations ?? [])
      .map((o: any) => (typeof o === 'string' ? o : o?.id))
      .filter(Boolean);
    const missing = orgIds.filter((id) => !listed.includes(id));
    if (missing.length === 0) {
      console.log(`Project "${name}" already lists the automation org(s)`);
      continue;
    }
    // PUT /admin/projects/:id re-validates the full project JSON (amenities.icon
    // etc.) so we cannot safely patch access from this script. Grant the
    // Automation Test Org in Admin → Projects → Organization Access.
    console.warn(
      `Project "${name}" is not accessible_to_all and is missing ${missing.length} automation org(s). ` +
        `Grant access in the admin panel so webhook tests can create links.`
    );
  }
}
