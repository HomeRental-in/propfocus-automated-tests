import { test, expect } from '@playwright/test';
import { API_BASE } from '../../utils/buyerLinks';
import {
  ADMIN_EMAIL,
  ADMIN_LIST_ENDPOINTS,
  adminCredsConfigured,
  adminGet,
  adminLogin,
  adminVerify,
  getEngagementAlertAudit,
  getEngagementAlertHealth,
  getVisitorAlertAudit,
} from '../../utils/adminApi';

// ======================================================
// ADMIN PANEL (backend /api/admin/... contract)
//
// All admin routes except login require Authorization: Bearer <token>.
// These tests log in per-test for isolation (APIRequestContext from the
// `request` fixture), then exercise auth, the read-only list endpoints,
// the alert-audit analytics endpoints, and the 401 rejection paths.
// ======================================================

test.describe('Admin Panel', () => {
  test.skip(
    !adminCredsConfigured(),
    'Set ADMIN_EMAIL and ADMIN_PASSWORD to run admin tests'
  );

  // ----------------------------------------------------
  // AUTH
  // ----------------------------------------------------

  test('ADMIN_LOGIN - login succeeds and returns a privileged admin @sanity', async ({
    request,
  }) => {
    const { token, admin } = await adminLogin(request);

    expect(token, 'login should return a token').toBeTruthy();
    expect(admin, 'login should return an admin object').toBeTruthy();
    expect(
      admin.permission_level,
      'admin.permission_level should be truthy'
    ).toBeTruthy();
  });

  test('ADMIN_VERIFY - verify(token) returns matching admin @sanity', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);

    const admin = await adminVerify(request, token);

    expect(admin, 'verify should return an admin object').toBeTruthy();
    expect(admin.email, 'verify email should match login email').toBe(
      ADMIN_EMAIL
    );
  });

  // ----------------------------------------------------
  // READ-ONLY LIST ENDPOINTS (data-driven)
  // ----------------------------------------------------

  for (const entry of ADMIN_LIST_ENDPOINTS) {
    test(`ADMIN_LIST_${entry.key.toUpperCase()} - ${entry.path} returns an array @sanity`, async ({
      request,
    }) => {
      const { token } = await adminLogin(request);

      const { status, body } = await adminGet(request, token, entry.path);

      expect(status, `${entry.path} should return 200`).toBe(200);
      expect(
        Array.isArray(body[entry.arrayKey]),
        `${entry.path} body.${entry.arrayKey} should be an array`
      ).toBe(true);
    });
  }

  // ----------------------------------------------------
  // ALERT AUDIT ANALYTICS
  // ----------------------------------------------------

  test('ADMIN_ALERT_AUDIT - engagement + visitor alert endpoints reachable @sanity', async ({
    request,
  }) => {
    const { token } = await adminLogin(request);

    const health = await getEngagementAlertHealth(request, token);
    expect(health, 'engagement-alert-health should return an object').toEqual(
      expect.any(Object)
    );
    expect(
      health.summary,
      'engagement-alert-health body should have a .summary'
    ).toBeTruthy();

    const engagement = await getEngagementAlertAudit(request, token);
    expect(
      Array.isArray(engagement),
      'engagement-alert-audit should return an array'
    ).toBe(true);

    const visitor = await getVisitorAlertAudit(request, token);
    expect(
      Array.isArray(visitor),
      'visitor-alert-audit should return an array'
    ).toBe(true);
  });

  // ----------------------------------------------------
  // AUTHORIZATION GUARDS
  // ----------------------------------------------------

  test('ADMIN_NO_AUTH - unauthenticated admin access is blocked with 401 @regression', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/admin/projects`, {
      timeout: 30000,
    });

    expect(res.status(), 'no auth header should be rejected with 401').toBe(401);
  });

  test('ADMIN_BAD_TOKEN - invalid token is blocked with 401 @regression', async ({
    request,
  }) => {
    const { status } = await adminGet(
      request,
      'invalid.token.value',
      '/admin/projects'
    );

    expect(status, 'invalid token should be rejected with 401').toBe(401);
  });
});
