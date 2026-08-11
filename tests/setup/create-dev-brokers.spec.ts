/**
 * One-time DEV setup: create the test broker roster the suite logs in as.
 *
 * Most UI specs default to TEST_PHONE=9888898888, and the persona suites need
 * owner / GM / managers / reps — none of which exist on dev out of the box (login
 * returns "This phone number is not registered"). This script creates a dedicated
 * "Automation Test Org" and a full-role broker roster via the admin API, then prints
 * the .env block to paste. Idempotent: brokers whose phone already exists are reused.
 *
 * Requires admin creds in .env:  ADMIN_EMAIL=...  ADMIN_PASSWORD=...
 * Run:  npm run setup:brokers      (i.e. npx playwright test --grep @setup)
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import { adminLogin, adminCredsConfigured } from '../../utils/adminApi';

const BASE_URL = process.env.API_URL ?? process.env.BASE_URL ?? 'https://dev.propfocus.in';
const API_BASE = `${BASE_URL}/api`;

const ORG = { name: 'Automation Test Org', contactPhone: '9900000001' };

type OrgRoleLevel = 'organization_owner' | 'general_manager' | 'manager' | 'representative';
interface RosterEntry {
  key: string;
  phone: string;
  name: string;
  type: 'main' | 'sub';
  orgRoleLevel: OrgRoleLevel;
  teamFunction?: 'presales' | 'sales' | 'marketing';
  parentKey?: string; // sub → its manager (main broker)
}

// Mains first so a sub's manager id is available when it is created.
const ROSTER: RosterEntry[] = [
  { key: 'owner', phone: '9900000001', name: 'Automation Owner', type: 'main', orgRoleLevel: 'organization_owner' },
  { key: 'gm', phone: '9900000002', name: 'Automation General Manager', type: 'main', orgRoleLevel: 'general_manager' },
  { key: 'presalesManager', phone: '9900000003', name: 'Automation Presales Manager', type: 'main', orgRoleLevel: 'manager', teamFunction: 'presales' },
  { key: 'salesManager', phone: '9900000004', name: 'Automation Sales Manager', type: 'main', orgRoleLevel: 'manager', teamFunction: 'sales' },
  { key: 'marketingManager', phone: '9900000005', name: 'Automation Marketing Manager', type: 'main', orgRoleLevel: 'manager', teamFunction: 'marketing' },
  { key: 'mainBroker', phone: '9999999999', name: 'Automation Main Broker', type: 'main', orgRoleLevel: 'manager', teamFunction: 'presales' },
  { key: 'presalesRep', phone: '9900000011', name: 'Automation Presales Rep', type: 'sub', orgRoleLevel: 'representative', teamFunction: 'presales', parentKey: 'presalesManager' },
  { key: 'salesRep', phone: '9900000012', name: 'Automation Sales Rep', type: 'sub', orgRoleLevel: 'representative', teamFunction: 'sales', parentKey: 'salesManager' },
  { key: 'marketingRep', phone: '9900000013', name: 'Automation Marketing Rep', type: 'sub', orgRoleLevel: 'representative', teamFunction: 'marketing', parentKey: 'marketingManager' },
  { key: 'subBroker', phone: '9888898888', name: 'Automation Sub Broker', type: 'sub', orgRoleLevel: 'representative', teamFunction: 'presales', parentKey: 'presalesManager' },
];

const last10 = (p: string) => String(p ?? '').replace(/\D/g, '').slice(-10);

async function ensureOrg(request: APIRequestContext, token: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}` };
  const listRes = await request.get(`${API_BASE}/admin/organizations`, { headers: auth, timeout: 45000 });
  const listBody = await listRes.json().catch(() => ({}));
  const existing = (listBody.organizations ?? []).find((o: any) => o.name === ORG.name);
  if (existing?.id) {
    console.log(`Org "${ORG.name}" exists → ${existing.id}`);
    return existing.id;
  }
  const res = await request.post(`${API_BASE}/admin/organizations`, {
    headers: auth,
    data: { name: ORG.name, contact_phone: ORG.contactPhone, status: 'free', plan: 'free' },
    timeout: 45000,
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `create org failed: ${JSON.stringify(body)}`).toBeLessThan(300);
  const id = body.organization?.id ?? body.data?.id;
  expect(id, `no organization id returned: ${JSON.stringify(body)}`).toBeTruthy();
  console.log(`Org "${ORG.name}" created → ${id}`);
  return id;
}

async function listBrokersByPhone(request: APIRequestContext, token: string): Promise<Map<string, string>> {
  const res = await request.get(`${API_BASE}/admin/brokers`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 45000,
  });
  const body = await res.json().catch(() => ({}));
  const map = new Map<string, string>();
  for (const b of body.brokers ?? []) {
    if (b?.phone && b?.id) map.set(last10(b.phone), b.id);
  }
  return map;
}

async function createBroker(
  request: APIRequestContext,
  token: string,
  orgId: string,
  entry: RosterEntry,
  idByKey: Record<string, string>
): Promise<string> {
  const data: Record<string, unknown> = {
    name: entry.name,
    phone: entry.phone,
    type: entry.type,
    organization_id: orgId,
    org_role_level: entry.orgRoleLevel,
    team_function: entry.teamFunction ?? null,
  };
  if (entry.type === 'sub' && entry.parentKey) {
    const parentId = idByKey[entry.parentKey];
    data.main_broker_ids = [parentId];
    data.parent_id = parentId;
  }
  const res = await request.post(`${API_BASE}/admin/brokers`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
    timeout: 45000,
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `create broker ${entry.phone} failed: ${JSON.stringify(body)}`).toBeLessThan(300);
  const id = body.broker?.id ?? body.data?.id;
  expect(id, `no broker id returned for ${entry.phone}: ${JSON.stringify(body)}`).toBeTruthy();
  return id;
}

test.describe('Dev broker setup', () => {
  test.describe.configure({ mode: 'serial' });

  test('@setup - provision automation broker roster', async ({ request }) => {
    test.skip(!adminCredsConfigured(), 'Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to run broker setup');
    test.setTimeout(180_000);

    const { token } = await adminLogin(request);
    const orgId = await ensureOrg(request, token);
    const existingByPhone = await listBrokersByPhone(request, token);

    const idByKey: Record<string, string> = {};
    const summary: Array<{ role: string; phone: string; id: string; created: boolean }> = [];

    for (const entry of ROSTER) {
      const phone10 = last10(entry.phone);
      let id = existingByPhone.get(phone10);
      let created = false;
      if (!id) {
        id = await createBroker(request, token, orgId, entry, idByKey);
        created = true;
      }
      idByKey[entry.key] = id;
      summary.push({
        role: `${entry.orgRoleLevel}${entry.teamFunction ? `/${entry.teamFunction}` : ''}`,
        phone: entry.phone,
        id,
        created,
      });
    }

    console.log('\n─── Broker roster ───');
    for (const s of summary) {
      console.log(`  ${s.created ? 'CREATED' : 'exists '}  ${s.phone}  ${s.role}  ${s.id}`);
    }
    console.log('\n─── Paste into .env ───');
    console.log(`OWNER_PHONE=9900000001`);
    console.log(`GM_PHONE=9900000002`);
    console.log(`PRESALES_MANAGER_PHONE=9900000003`);
    console.log(`PRESALES_REP_PHONE=9900000011`);
    console.log(`SALES_REP_PHONE=9900000012`);
    console.log(`MARKETING_REP_PHONE=9900000013`);
    console.log(`TEST_PHONE=9888898888`);
    console.log(`MAIN_BROKER_PHONE=9999999999`);
    console.log(`SUB_BROKER_PHONE=9888898888`);
    console.log('─────────────────────\n');

    // Every roster entry must have resolved to an id.
    expect(summary.every((s) => Boolean(s.id))).toBe(true);
  });
});
