/**
 * Admin API helpers (staff admin panel + alert audit).
 *
 * Backend admin routes are mounted at /api/admin/... (the frontend path
 * obfuscation is UI-only and does not affect the API).
 *
 * Endpoints (confirmed against backend):
 *   POST /api/admin/auth/login    { email, password }  -> token, admin{ permission_level }
 *   GET  /api/admin/auth/verify                         -> admin
 *   GET  /api/admin/analytics/engagement-alert-audit?hours=&limit=  -> entries[]  (broker alert fired?)
 *   GET  /api/admin/analytics/engagement-alert-health?hours=        -> summary
 *   GET  /api/admin/analytics/visitor-alert-audit?limit=            -> entries[] (whatsappSentAt)
 *   GET  /api/admin/projects | brokers | organizations | eoi-campaigns | reports  (read-only lists)
 *
 * All admin calls except login require: Authorization: Bearer <admin token>.
 */

import { expect, APIRequestContext } from '@playwright/test';
import { API_BASE } from './buyerLinks';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

export interface AdminSession {
  token: string;
  admin: { id: string; email: string; permission_level: string; [k: string]: unknown };
}

export function adminCredsConfigured(): boolean {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

export async function adminLogin(
  request: APIRequestContext,
  email: string = ADMIN_EMAIL,
  password: string = ADMIN_PASSWORD
): Promise<AdminSession> {
  const res = await request.post(`${API_BASE}/admin/auth/login`, {
    data: { email, password },
    timeout: 30000,
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `admin login failed: ${JSON.stringify(body)}`).toBe(200);
  expect(body.token, 'no admin token returned').toBeTruthy();
  return { token: body.token, admin: body.admin };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function adminGet(
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

export async function adminPost(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const res = await request.post(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    data,
    timeout: 45000,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function adminPut(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const res = await request.put(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    data,
    timeout: 45000,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function adminPatch(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const res = await request.patch(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    data,
    timeout: 45000,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function adminDelete(
  request: APIRequestContext,
  token: string,
  path: string
): Promise<{ status: number; body: any }> {
  const res = await request.delete(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    timeout: 45000,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

export async function adminVerify(request: APIRequestContext, token: string) {
  const { status, body } = await adminGet(request, token, '/admin/auth/verify');
  expect(status).toBe(200);
  return body.admin;
}

// ---- Alert audit (broker alert verification) ----

export interface EngagementAlertEntry {
  id: string;
  status: 'sent' | 'sending' | 'failed';
  triggerEventType: string;
  recipientPhone: string;
  brokerName: string;
  brokerPhone: string;
  micrositeId: string;
  endUser: string;
  buyerId: string;
  sentAt: string | null;
  canRetry: boolean;
  [key: string]: unknown;
}

export async function getEngagementAlertAudit(
  request: APIRequestContext,
  token: string,
  params?: { hours?: number; limit?: number }
): Promise<EngagementAlertEntry[]> {
  const { status, body } = await adminGet(request, token, '/admin/analytics/engagement-alert-audit', {
    hours: params?.hours ?? 24,
    limit: params?.limit ?? 200,
  });
  expect(status, `engagement-alert-audit failed: ${JSON.stringify(body)}`).toBe(200);
  return (body.entries ?? []) as EngagementAlertEntry[];
}

export async function getEngagementAlertHealth(
  request: APIRequestContext,
  token: string,
  hours = 24
): Promise<any> {
  const { status, body } = await adminGet(request, token, '/admin/analytics/engagement-alert-health', {
    hours,
  });
  expect(status).toBe(200);
  return body;
}

export async function getVisitorAlertAudit(
  request: APIRequestContext,
  token: string,
  limit = 200
): Promise<any[]> {
  const { status, body } = await adminGet(request, token, '/admin/analytics/visitor-alert-audit', {
    limit,
  });
  expect(status).toBe(200);
  return body.entries ?? [];
}

// ---- Read-only list endpoints (admin-panel smoke) ----

export const ADMIN_LIST_ENDPOINTS: Array<{ key: string; path: string; arrayKey: string }> = [
  { key: 'projects', path: '/admin/projects', arrayKey: 'projects' },
  { key: 'brokers', path: '/admin/brokers', arrayKey: 'brokers' },
  { key: 'organizations', path: '/admin/organizations', arrayKey: 'organizations' },
  { key: 'eoi-campaigns', path: '/admin/eoi-campaigns', arrayKey: 'campaigns' },
  { key: 'reports', path: '/admin/reports', arrayKey: 'reports' },
];
