import { test, expect } from '@playwright/test';
import { API_BASE } from '../../utils/buyerLinks';
import {
  adminCredsConfigured,
  adminLogin,
  adminGet,
  adminPost,
  adminPut,
  adminDelete,
} from '../../utils/adminApi';

// ======================================================
// ADMIN CONSOLE CRUD (backend/routes/admin.js)
//
// Exercises a full create -> read -> update -> delete lifecycle against a
// low-risk, standalone entity (BUILDERS) so the write paths of the admin
// console are actually covered (admin-panel.spec.ts is read-only).
//
// Contract (confirmed against backend):
//   GET    /api/admin/builders        -> { success, builders[] }
//   POST   /api/admin/builders        -> 201 { success, builder }
//                                        400 if builder_name missing
//                                        409 if name already exists
//   PUT    /api/admin/builders/:id     -> { success, builder } | 404 | 409
//   DELETE /api/admin/builders/:id     -> { success, builder } | 404
//                                        requires Guardian permission (403 otherwise)
//
// Builders have no dependencies for a freshly-created row, so the lifecycle is
// safe. Names are namespaced + timestamped and always cleaned up in afterAll.
// ======================================================

const RUN = adminCredsConfigured();
const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PREFIX = 'AUTOTEST Builder';

test.describe('Admin Console CRUD — Builders', () => {
  test.skip(!RUN, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run admin tests');

  const createdIds = new Set<string>();

  test.afterAll(async ({ request }) => {
    if (!RUN || createdIds.size === 0) return;
    const { token } = await adminLogin(request);
    for (const id of createdIds) {
      // Best-effort — delete needs Guardian; leftover rows are clearly namespaced.
      await adminDelete(request, token, `/admin/builders/${id}`).catch(() => {});
    }
  });

  // ----------------------------------------------------
  // READ
  // ----------------------------------------------------

  test('CRUD_BUILDER_LIST - list returns a builders array @sanity', async ({ request }) => {
    const { token } = await adminLogin(request);
    const { status, body } = await adminGet(request, token, '/admin/builders');

    expect(status, 'list should be 200').toBe(200);
    expect(Array.isArray(body.builders), 'body.builders should be an array').toBe(true);
  });

  // ----------------------------------------------------
  // CREATE -> READ -> UPDATE -> DELETE lifecycle
  // ----------------------------------------------------

  test('CRUD_BUILDER_LIFECYCLE - create, read, update, delete @sanity', async ({ request }) => {
    const { token } = await adminLogin(request);
    const name = `${PREFIX} ${stamp()}`;

    // CREATE
    const created = await adminPost(request, token, '/admin/builders', {
      builder_name: name,
      tagline: 'Automation tagline',
      description: 'Created by the E2E admin CRUD suite',
    });
    expect(created.status, `create failed: ${JSON.stringify(created.body)}`).toBe(201);
    const builder = created.body.builder;
    expect(builder?.id, 'create should return builder.id').toBeTruthy();
    expect(builder.builder_name).toBe(name);
    const id = String(builder.id);
    createdIds.add(id);

    // READ (list contains it — builders has no GET /:id route)
    const list = await adminGet(request, token, '/admin/builders');
    expect(
      (list.body.builders ?? []).some((b: any) => String(b.id) === id),
      'created builder should appear in the list'
    ).toBe(true);

    // UPDATE (rename + edit tagline)
    const renamed = `${name} EDITED`;
    const updated = await adminPut(request, token, `/admin/builders/${id}`, {
      builder_name: renamed,
      tagline: 'Automation tagline (edited)',
    });
    expect(updated.status, `update failed: ${JSON.stringify(updated.body)}`).toBe(200);
    expect(updated.body.builder?.builder_name).toBe(renamed);

    // DELETE (Guardian-gated — tolerate 403 on non-Guardian admins)
    const del = await adminDelete(request, token, `/admin/builders/${id}`);
    expect([200, 403]).toContain(del.status);
    if (del.status === 200) {
      createdIds.delete(id);
      const after = await adminGet(request, token, '/admin/builders');
      expect(
        (after.body.builders ?? []).some((b: any) => String(b.id) === id),
        'deleted builder should no longer be in the list'
      ).toBe(false);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Delete returned 403 — test admin is not Guardian; row cleaned up in afterAll.',
      });
    }
  });

  // ----------------------------------------------------
  // NEGATIVES / VALIDATION
  // ----------------------------------------------------

  test('CRUD_BUILDER_NO_NAME - missing builder_name is rejected 400 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status } = await adminPost(request, token, '/admin/builders', {
      tagline: 'no name here',
    });
    expect(status, 'create without builder_name should be 400').toBe(400);
  });

  test('CRUD_BUILDER_DUPLICATE - duplicate name is rejected 409 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const name = `${PREFIX} ${stamp()}`;

    const first = await adminPost(request, token, '/admin/builders', { builder_name: name });
    expect(first.status).toBe(201);
    createdIds.add(String(first.body.builder.id));

    const dup = await adminPost(request, token, '/admin/builders', { builder_name: name });
    expect(dup.status, 'duplicate builder name should be 409').toBe(409);
  });

  test('CRUD_BUILDER_UPDATE_UNKNOWN - updating a missing builder returns 404 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status } = await adminPut(
      request,
      token,
      '/admin/builders/00000000-0000-0000-0000-000000000000',
      { builder_name: `${PREFIX} ghost ${stamp()}` }
    );
    expect(status, 'update of unknown builder should be 404').toBe(404);
  });

  test('CRUD_BUILDER_NO_AUTH - unauthenticated write is blocked 401 @security', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/admin/builders`, {
      data: { builder_name: `${PREFIX} noauth ${stamp()}` },
      timeout: 30000,
    });
    expect(res.status(), 'no auth header should be 401').toBe(401);
  });
});
