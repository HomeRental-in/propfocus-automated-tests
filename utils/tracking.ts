/**
 * Tracking helpers — ingest an event on each buyer page and read it back.
 *
 * Endpoints (confirmed against backend):
 *   Microsite : POST /api/track-event                     (flat envelope)
 *               GET  /api/microsite/:id/events            (flat envelope)
 *   Site visit: POST /api/site-visit/:linkToken/activity  (data.recorded)
 *               GET  /api/site-visit/:linkToken           (data.siteVisit + records a view)
 *   Post visit: POST /api/post-visit/:linkToken/activity  (data.recorded)
 *               GET  /api/post-visit/:linkToken           (data.postVisitPage + records a view)
 *   EOI       : POST /api/eoi/:linkToken/activity         (data.recorded)
 *               GET  /api/eoi/:linkToken                  (data.eoiPage + records a view)
 *
 * Tracking is theme-agnostic: Apex / Zenith / project themes / EOI 'hola' all
 * funnel into these same endpoints — themes only vary a metadata click_source.
 */

import { expect, APIRequestContext } from '@playwright/test';
import { API_BASE } from './buyerLinks';

// ---- Enumerable event/activity vocabularies (from backend constants) ----

/** Subset of the microsite `events` enum most useful to assert on. */
export const MICROSITE_EVENT_TYPES = [
  'link_open',
  'page_view',
  'project_details_viewed',
  'gallery_viewed',
  'download_brochure',
  'url_shared',
  'site_visit_booked',
] as const;

/** siteVisitService SV_ACTIVITY / svIntentWindowAlerts labels. */
export const SV_ACTIVITY_TYPES = [
  'checked_location',
  'checked_weather',
  'viewed_project_details',
  'set_reminder',
  'called_project_manager',
  'requested_callback',
  'viewed_gallery',
  'watched_video',
] as const;

/** postVisitIntentWindowAlerts PVP_ACTIVITY labels. */
export const PVP_ACTIVITY_TYPES = [
  'requested_callback',
  'cost_sheet_requested',
  'cost_sheet_downloaded',
  'maps_clicked',
  'floor_plan_viewed',
  'contact_whatsapp',
  'contact_call',
  'plan_revisit',
  'testimonial_viewed',
  'testimonial_video_played',
] as const;

/** eoiPageService EOIP_ACTIVITY_TYPES. */
export const EOIP_ACTIVITY_TYPES = [
  'requested_callback',
  'contact_wa_call',
  'whatsapp_clicked',
  'call_clicked',
  'config_selected',
  'faq_opened',
  'cta_clicked',
  'lock_price_clicked',
  'calendar_clicked',
  'gallery_opened',
  'film_played',
  'see_pricing',
  'visit_requested',
  'visit_sheet_opened',
  'phase_microsite_opened',
] as const;

/** Random device id so ingest is not treated as broker self-tracking. */
export function randomDeviceId(): string {
  return `dev-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// ======================================================
// Microsite
// ======================================================

export async function trackMicrositeEvent(
  request: APIRequestContext,
  micrositeId: string,
  eventType: string,
  deviceId: string = randomDeviceId()
): Promise<any> {
  const res = await request.post(`${API_BASE}/track-event`, {
    data: { micrositeId, eventType, deviceId },
    timeout: 30000,
  });
  const body = await res.json().catch(() => ({}));
  console.log(`track-event ${eventType} -> ${res.status()} ${JSON.stringify(body)}`);
  return body;
}

export async function getMicrositeEvents(
  request: APIRequestContext,
  micrositeId: string,
  params?: { eventType?: string; limit?: number }
): Promise<{ success: boolean; events: any[]; pagination?: any }> {
  const search = new URLSearchParams();
  if (params?.eventType) search.set('event_type', params.eventType);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const res = await request.get(
    `${API_BASE}/microsite/${encodeURIComponent(micrositeId)}/events${qs ? `?${qs}` : ''}`,
    { timeout: 30000 }
  );
  expect(res.status()).toBe(200);
  return res.json();
}

// ======================================================
// Site visit / Post visit / EOI (shared shape)
// ======================================================

async function postActivity(
  request: APIRequestContext,
  segment: 'site-visit' | 'post-visit' | 'eoi',
  linkToken: string,
  activityType: string
): Promise<{ recorded: boolean; reason: string | null }> {
  const res = await request.post(
    `${API_BASE}/${segment}/${encodeURIComponent(linkToken)}/activity`,
    { data: { activity_type: activityType }, timeout: 30000 }
  );
  const body = await res.json().catch(() => ({}));
  console.log(`${segment} activity ${activityType} -> ${res.status()} ${JSON.stringify(body)}`);
  return body?.data ?? { recorded: false, reason: `http_${res.status()}` };
}

export const trackSiteVisitActivity = (
  request: APIRequestContext,
  linkToken: string,
  activityType: string
) => postActivity(request, 'site-visit', linkToken, activityType);

export const trackPostVisitActivity = (
  request: APIRequestContext,
  linkToken: string,
  activityType: string
) => postActivity(request, 'post-visit', linkToken, activityType);

export const trackEoiActivity = (
  request: APIRequestContext,
  linkToken: string,
  activityType: string
) => postActivity(request, 'eoi', linkToken, activityType);

async function getPage(
  request: APIRequestContext,
  segment: 'site-visit' | 'post-visit' | 'eoi',
  linkToken: string
): Promise<any> {
  const res = await request.get(`${API_BASE}/${segment}/${encodeURIComponent(linkToken)}`, {
    timeout: 30000,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body, data: body?.data };
}

export const getSiteVisit = (request: APIRequestContext, linkToken: string) =>
  getPage(request, 'site-visit', linkToken);

export const getPostVisit = (request: APIRequestContext, linkToken: string) =>
  getPage(request, 'post-visit', linkToken);

export const getEoi = (request: APIRequestContext, linkToken: string) =>
  getPage(request, 'eoi', linkToken);
