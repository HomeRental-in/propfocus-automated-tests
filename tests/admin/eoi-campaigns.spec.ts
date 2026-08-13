import { test, expect } from '@playwright/test';
import { API_BASE } from '../../utils/buyerLinks';
import {
  adminCredsConfigured,
  adminLogin,
  adminGet,
  adminPost,
  adminPatch,
  adminDelete,
} from '../../utils/adminApi';

// ======================================================
// ADMIN EOI CAMPAIGNS (backend/routes/adminEoiCampaigns.js)
//
// Contract (confirmed against backend):
//   GET    /api/admin/eoi-campaigns              -> { success, campaigns[] }
//   GET    /api/admin/eoi-campaigns/:id          -> { success, campaign } | 404
//   POST   /api/admin/eoi-campaigns              -> 201 { success, campaign }
//                                                   400 if name / builder_id missing
//   PATCH  /api/admin/eoi-campaigns/:id          -> { success, campaign } | 404
//   PATCH  /api/admin/eoi-campaigns/:id/status   -> { success, campaign }
//                                                   400 if status not active|inactive
//   DELETE /api/admin/eoi-campaigns/:id          -> { deleted:true } | { deactivated:true }
//                                                   (soft-deactivates when buyer pages exist)
//
// All routes require Authorization: Bearer <admin token>.
// Every test that creates a campaign registers it for afterAll cleanup so the
// dev DB is never polluted, even on assertion failure.
// ======================================================

const RUN = adminCredsConfigured();
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const AUTOMATION_PREFIX = 'AUTOTEST EOI';

test.describe('Admin EOI Campaigns — CRUD', () => {
  test.skip(!RUN, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run admin tests');

  const createdIds = new Set<string>();

  // A builder_id is mandatory on create — grab a real one from the admin API.
  async function firstBuilderId(request: any, token: string): Promise<string | null> {
    const { status, body } = await adminGet(request, token, '/admin/builders');
    if (status !== 200 || !Array.isArray(body.builders) || body.builders.length === 0) {
      return null;
    }
    return String(body.builders[0].id);
  }

  test.afterAll(async ({ request }) => {
    if (!RUN || createdIds.size === 0) return;
    const { token } = await adminLogin(request);
    for (const id of createdIds) {
      await adminDelete(request, token, `/admin/eoi-campaigns/${id}`).catch(() => {});
    }
  });

  // ----------------------------------------------------
  // READ
  // ----------------------------------------------------

  test('EOI_CAMP_LIST - list returns a campaigns array @sanity', async ({ request }) => {
    const { token } = await adminLogin(request);
    const { status, body } = await adminGet(request, token, '/admin/eoi-campaigns');

    expect(status, 'list should be 200').toBe(200);
    expect(Array.isArray(body.campaigns), 'body.campaigns should be an array').toBe(true);
  });

  // ----------------------------------------------------
  // CREATE -> READ -> UPDATE -> STATUS -> DELETE lifecycle
  // ----------------------------------------------------

  test('EOI_CAMP_LIFECYCLE - create, read, update, toggle status, delete @sanity', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);

    const builderId = await firstBuilderId(request, token);
    test.skip(!builderId, 'No builders exist on this environment to attach an EOI campaign to');

    const name = `${AUTOMATION_PREFIX} ${stamp()}`;

    // CREATE
    const created = await adminPost(request, token, '/admin/eoi-campaigns', {
      name,
      builder_id: builderId,
      accessible_to_all: true,
      is_active: true,
    });
    expect(created.status, `create failed: ${JSON.stringify(created.body)}`).toBe(201);
    const campaign = created.body.campaign;
    expect(campaign?.id, 'create should return campaign.id').toBeTruthy();
    expect(campaign.name).toBe(name);
    const id = String(campaign.id);
    createdIds.add(id);

    // READ back by id
    const read = await adminGet(request, token, `/admin/eoi-campaigns/${id}`);
    expect(read.status, 'get by id should be 200').toBe(200);
    expect(read.body.campaign?.name).toBe(name);

    // Appears in the list
    const list = await adminGet(request, token, '/admin/eoi-campaigns');
    expect(
      (list.body.campaigns ?? []).some((c: any) => String(c.id) === id),
      'created campaign should appear in the list'
    ).toBe(true);

    // UPDATE (rename)
    const renamed = `${name} EDITED`;
    const updated = await adminPatch(request, token, `/admin/eoi-campaigns/${id}`, {
      name: renamed,
      builder_id: builderId,
    });
    expect(updated.status, `update failed: ${JSON.stringify(updated.body)}`).toBe(200);
    expect(updated.body.campaign?.name).toBe(renamed);

    // STATUS toggle -> inactive
    const deactivated = await adminPatch(
      request,
      token,
      `/admin/eoi-campaigns/${id}/status`,
      { status: 'inactive' }
    );
    expect(deactivated.status, 'status change should be 200').toBe(200);
    expect(deactivated.body.campaign?.is_active).toBe(false);

    // DELETE (no buyer pages exist -> hard delete)
    const del = await adminDelete(request, token, `/admin/eoi-campaigns/${id}`);
    expect(del.status, 'delete should be 200').toBe(200);
    expect(del.body.deleted === true || del.body.deactivated === true).toBe(true);
    if (del.body.deleted === true) createdIds.delete(id);

    // Confirm gone (only when a true delete happened)
    if (del.body.deleted === true) {
      const afterDelete = await adminGet(request, token, `/admin/eoi-campaigns/${id}`);
      expect(afterDelete.status, 'deleted campaign should 404').toBe(404);
    }
  });

  // ----------------------------------------------------
  // NEGATIVES / VALIDATION
  // ----------------------------------------------------

  test('EOI_CAMP_CREATE_NO_NAME - missing name is rejected 400 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const builderId = await firstBuilderId(request, token);
    test.skip(!builderId, 'No builders exist on this environment');

    const { status } = await adminPost(request, token, '/admin/eoi-campaigns', {
      builder_id: builderId,
    });
    expect(status, 'create without name should be 400').toBe(400);
  });

  test('EOI_CAMP_CREATE_NO_BUILDER - missing builder_id is rejected 400 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status } = await adminPost(request, token, '/admin/eoi-campaigns', {
      name: `${AUTOMATION_PREFIX} ${stamp()}`,
    });
    expect(status, 'create without builder_id should be 400').toBe(400);
  });

  test('EOI_CAMP_STATUS_INVALID - invalid status value is rejected 400 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const builderId = await firstBuilderId(request, token);
    test.skip(!builderId, 'No builders exist on this environment');

    const created = await adminPost(request, token, '/admin/eoi-campaigns', {
      name: `${AUTOMATION_PREFIX} ${stamp()}`,
      builder_id: builderId,
      accessible_to_all: true,
    });
    expect(created.status).toBe(201);
    const id = String(created.body.campaign.id);
    createdIds.add(id);

    const bad = await adminPatch(request, token, `/admin/eoi-campaigns/${id}/status`, {
      status: 'archived',
    });
    expect(bad.status, 'invalid status should be 400').toBe(400);
  });

  test('EOI_CAMP_GET_UNKNOWN - unknown campaign id returns 404 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status } = await adminGet(
      request,
      token,
      '/admin/eoi-campaigns/00000000-0000-0000-0000-000000000000'
    );
    expect(status, 'unknown id should be 404').toBe(404);
  });

  test('EOI_CAMP_NO_AUTH - unauthenticated access is blocked 401 @security', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/admin/eoi-campaigns`, { timeout: 30000 });
    expect(res.status(), 'no auth header should be 401').toBe(401);
  });
});
