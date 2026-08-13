import { test, expect } from '@playwright/test';
import { API_BASE } from '../../utils/buyerLinks';
import {
  adminCredsConfigured,
  adminLogin,
  adminGet,
  adminPost,
} from '../../utils/adminApi';

// ======================================================
// FOLLOW-UP / LEAD RE-ENGAGEMENT (backend/index.js, apiRouter)
//
// Contract (confirmed against backend):
//   GET      /api/followup/brokers               -> { success, brokers[] }
//   GET|POST /api/followup/eligible/:brokerId     -> eligible follow-up payload
//                                                    400 if brokerId missing (path-empty)
//   POST     /api/followup/trigger { brokerId }    -> sends a WhatsApp digest + marks
//                                                    leads followed-up. 400 if no brokerId.
//   GET      /api/admin/lead-reengagement-stats    -> { success, summary }
//
// Auth: requireAdminOrApiKey -> falls back to authenticateAdmin, so an admin
// Bearer token is accepted and missing/invalid auth yields 401.
//
// SAFETY: POST /followup/trigger is OUTBOUND (real WhatsApp). We only exercise
// its validation + auth guards and NEVER call it with a live broker id.
// ======================================================

const RUN = adminCredsConfigured();

test.describe('Follow-up & Lead Re-engagement — API', () => {
  test.skip(!RUN, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run follow-up admin tests');

  // ----------------------------------------------------
  // READ / ORCHESTRATION CONTRACTS
  // ----------------------------------------------------

  test('FUP_BROKERS - eligible follow-up brokers list is returned @sanity', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status, body } = await adminGet(request, token, '/followup/brokers');

    expect(status, `followup/brokers failed: ${JSON.stringify(body)}`).toBe(200);
    expect(body.success, 'response should be success:true').toBe(true);
    expect(Array.isArray(body.brokers), 'body.brokers should be an array').toBe(true);
  });

  test('FUP_ELIGIBLE - eligible follow-up leads for a broker respond with a payload @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);

    const list = await adminGet(request, token, '/followup/brokers');
    const brokerId = (list.body.brokers ?? [])[0]?.id;
    test.skip(!brokerId, 'No follow-up-eligible brokers on this environment');

    const { status, body } = await adminGet(
      request,
      token,
      `/followup/eligible/${brokerId}`
    );

    expect(status, `eligible endpoint failed: ${JSON.stringify(body)}`).toBe(200);
    expect(body, 'eligible response should be an object').toEqual(expect.any(Object));
  });

  test('FUP_REENGAGEMENT_STATS - lead re-engagement audit summary is returned @sanity', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status, body } = await adminGet(
      request,
      token,
      '/admin/lead-reengagement-stats'
    );

    expect(status, `reengagement-stats failed: ${JSON.stringify(body)}`).toBe(200);
    expect(body.success, 'response should be success:true').toBe(true);
    expect(body.summary, 'response should carry a .summary').toEqual(expect.any(Object));
  });

  // ----------------------------------------------------
  // VALIDATION (non-destructive — trigger is never fired with a real broker)
  // ----------------------------------------------------

  test('FUP_TRIGGER_NO_BROKER - trigger without brokerId is rejected 400 @regression', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);
    const { status } = await adminPost(request, token, '/followup/trigger', {});
    expect(status, 'trigger without brokerId should be 400').toBe(400);
  });

  // ----------------------------------------------------
  // AUTHORIZATION GUARDS
  // ----------------------------------------------------

  test('FUP_BROKERS_NO_AUTH - unauthenticated access is blocked 401 @security', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/followup/brokers`, { timeout: 30000 });
    expect(res.status(), 'no auth header should be 401').toBe(401);
  });

  test('FUP_TRIGGER_NO_AUTH - unauthenticated trigger is blocked 401 @security', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/followup/trigger`, {
      data: { brokerId: 'does-not-matter' },
      timeout: 30000,
    });
    expect(res.status(), 'no auth header should be 401').toBe(401);
  });
});
