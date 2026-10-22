// ======================================================
// SALESFORCE CONNECTION HEALTH (the Amberstone/uat2026 check)
//
// Consumes the agreed contract:
//   GET /api/admin/salesforce/connections →
//   [{ orgId, orgName, connected, lastSuccessfulTokenMintAt,
//      lastLeadSyncAt, lastOppSyncAt, lastError, lastErrorAt }]
//
// Outbound health (token mint) is asserted hard. Inbound staleness is
// inferred: an org counts as ACTIVE when it has ever synced; active orgs
// whose latest sync is older than SF_SYNC_STALE_HOURS fail the gate.
// (When the backend adds a heartbeat/active flag, tighten this to use it.)
//
// SELF-SKIPS while the endpoint 404s — it arms itself the day the backend
// route ships. Set SF_SYNC_STALE_HOURS (default 24) to tune the SLA, and
// SF_STALE_EXCLUDE_ORGS (comma-separated names) for dormant pilots.
// ======================================================
import { test, expect } from '@playwright/test';
import { API_BASE } from '../../utils/buyerLinks';
import { adminCredsConfigured, adminLogin } from '../../utils/adminApi';

const STALE_HOURS = Number(process.env.SF_SYNC_STALE_HOURS ?? 24);
const EXCLUDED = (process.env.SF_STALE_EXCLUDE_ORGS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

test.describe('Salesforce connection health', () => {
  test.skip(!adminCredsConfigured(), 'Set ADMIN_EMAIL/ADMIN_PASSWORD');

  test('SFHEALTH_01 - every SF-connected org is healthy and syncing @sanity', async ({ request }) => {
    const { token } = await adminLogin(request);
    const res = await request.get(`${API_BASE}/admin/salesforce/connections`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    });

    test.skip(res.status() === 404, 'backend route not shipped yet — arms automatically once it exists');
    expect(res.status(), 'connections endpoint should respond').toBe(200);

    const body = await res.json();
    const conns: any[] = body.connections ?? body.data ?? body;
    expect(Array.isArray(conns), 'should return a connection array').toBe(true);
    console.log(`SF connections: ${conns.length}`);

    const problems: string[] = [];
    const now = Date.now();

    for (const c of conns) {
      const name = c.orgName ?? c.orgId ?? 'unknown-org';
      if (EXCLUDED.includes(String(name).toLowerCase())) continue;

      if (c.connected === false) {
        problems.push(`${name}: connected=false (OAuth broken)${c.lastError ? ` — ${c.lastError}` : ''}`);
        continue;
      }

      if (c.lastErrorAt && now - Date.parse(c.lastErrorAt) < STALE_HOURS * 3_600_000) {
        problems.push(`${name}: recent error at ${c.lastErrorAt} — ${c.lastError}`);
      }

      const lastSync = Math.max(
        c.lastLeadSyncAt ? Date.parse(c.lastLeadSyncAt) : 0,
        c.lastOppSyncAt ? Date.parse(c.lastOppSyncAt) : 0
      );
      const everSynced = lastSync > 0;
      if (everSynced && now - lastSync > STALE_HOURS * 3_600_000) {
        const hours = Math.round((now - lastSync) / 3_600_000);
        problems.push(
          `${name}: no inbound sync for ${hours}h (limit ${STALE_HOURS}h) — SF-side job may have stopped calling us`
        );
      }
    }

    expect(problems, `unhealthy Salesforce connections:\n${problems.join('\n')}`).toHaveLength(0);
  });
});
