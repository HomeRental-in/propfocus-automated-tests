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
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/send-otp`, {
    data: { phone },
    timeout: 30000,
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `send-otp failed for ${phone}: ${JSON.stringify(body)}`).toBe(200);
  const brokerId = body?.data?.brokerId;
  expect(brokerId, `no brokerId returned for ${phone}`).toBeTruthy();
  return brokerId;
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
  return { token, brokerId, user: body?.data?.user };
}

/** Full phone+OTP login, returns a usable session. */
export async function loginBroker(
  request: APIRequestContext,
  phone: string,
  otp: string = DASHBOARD_OTP
): Promise<BrokerSession> {
  const brokerId = await sendOtp(request, phone);
  return verifyOtp(request, brokerId, otp);
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
