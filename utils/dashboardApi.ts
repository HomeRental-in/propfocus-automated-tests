/**
 * Dashboard API helpers (broker phone+OTP login -> JWT -> scoped data reads).
 *
 * Endpoints (confirmed against backend):
 *   POST /api/auth/send-otp        { phone }            -> data.brokerId (+ data.devOtp on dev)
 *   POST /api/auth/verify-otp      { brokerId, otp }    -> data.token, data.user
 *   GET  /api/dashboard/broker-profile                  -> profile { orgRoleLevel, teamFunction, managerFunctions, hasOrgWideAccess, ... }
 *   GET  /api/dashboard/overview-stats?workspace=...    -> data.kpis / funnelTrend / leadWise / projectWise
 *   GET  /api/dashboard/microsites?workspace=...        -> data.microsites / pagination / stats
 *   GET  /api/dashboard/recent-activity?workspace=...   -> data.activity  (60s server cache, 7-day lookback)
 *
 * All /dashboard/* calls require header: Authorization: Bearer <token>.
 */

import { expect, APIRequestContext } from '@playwright/test';
import { API_BASE } from './buyerLinks';

export const DASHBOARD_OTP = process.env.DASHBOARD_OTP ?? '123456';

export interface BrokerSession {
  token: string;
  brokerId: string;
  user: any;
}

export interface BrokerProfile {
  brokerId: string;
  brokerName: string;
  brokerType: 'main' | 'sub';
  orgRoleLevel: 'organization_owner' | 'general_manager' | 'manager' | 'representative';
  teamFunction: 'presales' | 'sales' | 'marketing' | null;
  managerFunctions: string[];
  isOrganizationOwner: boolean;
  hasOrgWideAccess: boolean;
  organizationId: string;
  [key: string]: unknown;
}

export async function sendOtp(
  request: APIRequestContext,
  phone: string
): Promise<{ brokerId: string; devOtp?: string }> {
  const res = await request.post(`${API_BASE}/auth/send-otp`, {
    data: { phone },
    timeout: 30000,
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `send-otp failed for ${phone}: ${JSON.stringify(body)}`).toBe(200);
  const brokerId = body?.data?.brokerId;
  expect(brokerId, `no brokerId returned for ${phone}`).toBeTruthy();
  return { brokerId, devOtp: body?.data?.devOtp };
}

export async function verifyOtp(
  request: APIRequestContext,
  brokerId: string,
  otp: string = DASHBOARD_OTP
): Promise<BrokerSession> {
  const res = await request.post(`${API_BASE}/auth/verify-otp`, {
    data: { brokerId, otp },
    timeout: 30000,
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `verify-otp failed: ${JSON.stringify(body)}`).toBe(200);
  const token = body?.data?.token;
  expect(token, 'no token returned from verify-otp').toBeTruthy();
  return { token, brokerId: body?.data?.user?.brokerId ?? brokerId, user: body?.data?.user };
}

/**
 * Phone+OTP login. On deployed dev, calling send-otp stores a real OTP and
 * then blocks the 123456 bypass ("Admin bypass not available after OTP has
 * been sent"). The admin- prefix on verify-otp logs in without sending one.
 */
export async function loginBroker(
  request: APIRequestContext,
  phone: string,
  otp: string = DASHBOARD_OTP
): Promise<BrokerSession> {
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  const bypass = await request.post(`${API_BASE}/auth/verify-otp`, {
    data: { brokerId: `admin-${digits}-e2e`, otp },
    timeout: 30000,
  });
  const bypassBody = await bypass.json().catch(() => ({}));
  if (bypass.status() === 200 && bypassBody?.data?.token) {
    return {
      token: bypassBody.data.token,
      brokerId: bypassBody.data.user?.brokerId ?? digits,
      user: bypassBody.data.user,
    };
  }

  const { brokerId, devOtp } = await sendOtp(request, phone);
  return verifyOtp(request, brokerId, devOtp || otp);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function authGet(
  request: APIRequestContext,
  token: string,
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<{ status: number; body: any }> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  const res = await request.get(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token),
    timeout: 45000,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function getBrokerProfile(
  request: APIRequestContext,
  token: string
): Promise<BrokerProfile> {
  const { status, body } = await authGet(request, token, '/dashboard/broker-profile');
  expect(status, `broker-profile failed: ${JSON.stringify(body)}`).toBe(200);
  return body.profile as BrokerProfile;
}

export function getOverviewStats(
  request: APIRequestContext,
  token: string,
  params?: Record<string, string | number | undefined>
) {
  return authGet(request, token, '/dashboard/overview-stats', params);
}

export function getMicrosites(
  request: APIRequestContext,
  token: string,
  params?: Record<string, string | number | undefined>
) {
  return authGet(request, token, '/dashboard/microsites', params);
}

export function getRecentActivity(
  request: APIRequestContext,
  token: string,
  params?: Record<string, string | number | undefined>
) {
  return authGet(request, token, '/dashboard/recent-activity', params);
}

/**
 * Look up a just-created lead on the dashboard microsites list.
 * Used so webhook link-creation tests also prove the lead is visible in-product.
 */
export async function findLeadOnDashboard(
  request: APIRequestContext,
  token: string,
  query: { buyerName?: string; buyerId?: string }
): Promise<any | undefined> {
  const search = query.buyerName ?? query.buyerId ?? '';
  const { status, body } = await getMicrosites(request, token, { search, limit: 50 });
  expect(status, `microsites search failed: ${JSON.stringify(body)}`).toBe(200);
  const list: any[] = body?.data?.microsites ?? [];
  return list.find((row) => {
    const name = String(row.endUser ?? row.buyerName ?? row.end_user ?? '').toLowerCase();
    const id = String(row.buyerId ?? row.buyer_id ?? '').toLowerCase();
    if (query.buyerName && name.includes(query.buyerName.toLowerCase())) return true;
    if (query.buyerId && id === query.buyerId.toLowerCase()) return true;
    return false;
  });
}
