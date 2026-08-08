/**
 * Shared WhatsApp-bot buyer-link helpers for all FOUR link types:
 * microsite, site visit, post visit, EOI.
 *
 * All four are created through the same webhook:
 *   POST /api/whatsapp-webhook  { event: 'message', data: { from, body } }
 * and always return HTTP 200 (failures come back with a different message).
 *
 * Response field cheat-sheet (confirmed against backend):
 *   microsite   -> success, message, micrositeUrl, imageURL, link_token?
 *   site visit  -> success, message, link_token
 *   post visit  -> success, message, linkToken, postVisitUrl, reused
 *   EOI         -> success, message, linkToken, eoiUrl, reused, priority_number
 */

import { expect, APIRequestContext } from '@playwright/test';

export const WEBHOOK_URL =
  process.env.API_URL ?? 'https://dev.propfocus.in/api/whatsapp-webhook';

/** Base for the plain REST API (tracking / dashboard / admin), derived from the webhook URL. */
export const API_BASE =
  process.env.API_BASE ??
  WEBHOOK_URL.replace(/\/whatsapp-webhook\/?$/, '');

export const DEFAULT_PHONE = process.env.TEST_PHONE ?? '9888898888';

export type BuyerLinkType = 'microsite' | 'site_visit' | 'post_visit' | 'eoi';

export interface WebhookBody {
  success?: boolean;
  message?: string;
  error?: string;
  // microsite / site visit
  micrositeUrl?: string | null;
  imageURL?: string | null;
  link_token?: string;
  // post visit / eoi
  linkToken?: string;
  postVisitUrl?: string;
  eoiUrl?: string;
  reused?: boolean;
  priority_number?: number;
  // catch-all for fields we do not assert on
  [key: string]: unknown;
}

/** Fresh buyer id per call so dedupe/reuse logic does not silently return an old link. */
export function uniqueBuyerId(prefix = 'B'): string {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}${timestamp}${random}`;
}

/**
 * Fresh, ALPHABETIC buyer first-name so dashboard search finds exactly this
 * run's lead. Must contain no digits — a name with digits collides with the
 * bot's buyer-id parsing and triggers a clarification request instead of a link.
 */
export function uniqueBuyerName(prefix = 'Auto'): string {
  let x = Date.now();
  let letters = '';
  while (x > 0) {
    letters = String.fromCharCode(97 + (x % 26)) + letters;
    x = Math.floor(x / 26);
  }
  return `${prefix}${letters.slice(-7)}`;
}

/**
 * POST a WhatsApp message to the webhook, with 502 retry/backoff (dev cold starts)
 * and console logging that matches the rest of the suite.
 */
export async function postWebhook(
  request: APIRequestContext,
  messageBody: string,
  phone: string = DEFAULT_PHONE,
  options?: { allowNon200?: boolean }
): Promise<WebhookBody> {
  const payload = { event: 'message', data: { from: phone, body: messageBody } };

  let response = await request.post(WEBHOOK_URL, { data: payload, timeout: 60000 });
  let attempts = 0;
  while (response.status() === 502 && attempts < 3) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
    response = await request.post(WEBHOOK_URL, { data: payload, timeout: 60000 });
  }

  const body: WebhookBody = await response.json().catch(() => ({}));

  if (response.status() !== 200 && !options?.allowNon200) {
    expect(response.status()).toBe(200);
  }

  console.log(`\nPhone   : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(body, null, 2));

  // small settle delay so downstream side-effects (events, alerts) can persist
  await new Promise((resolve) => setTimeout(resolve, 800));
  return body;
}

// ======================================================
// Prompt builders (one per link type)
// ======================================================

export function buildMicrositePrompt(
  buyerName: string,
  buyerId: string,
  project: string,
  flag = ''
): string {
  return `${buyerName} ${buyerId} for ${project}${flag ? ` ${flag}` : ''}`.trim();
}

export function buildSiteVisitPrompt(
  buyerName: string,
  buyerId: string,
  project: string,
  slot = 'tomorrow 11 AM'
): string {
  return `${buyerName} ${buyerId} for sv ${project} on ${slot}`;
}

/** Post-visit trigger keyword is "visited" / "visit done" (past tense). */
export function buildPostVisitPrompt(
  buyerName: string,
  buyerId: string,
  project: string
): string {
  return `${buyerName} ${buyerId} visited ${project}`;
}

/** EOI trigger keyword is "eoi". Project must have an EOI campaign configured. */
export function buildEoiPrompt(
  buyerName: string,
  buyerId: string,
  project: string
): string {
  return `${buyerName} ${buyerId} for ${project} eoi`;
}

// ======================================================
// Success / failure assertions (per link type)
// ======================================================

export function assertMicrositeSuccess(body: WebhookBody): void {
  expect(body.success).toBe(true);
  expect(body.micrositeUrl).toBeTruthy();
  expect(body.message).toBeTruthy();
}

export function assertSiteVisitSuccess(body: WebhookBody): void {
  expect(body.success).toBe(true);
  expect(body.link_token).toBeTruthy();
}

export function assertPostVisitSuccess(body: WebhookBody): void {
  expect(body.success).toBe(true);
  expect(body.linkToken).toBeTruthy();
  expect(body.postVisitUrl).toBeTruthy();
  expect((body.message ?? '').toLowerCase()).toMatch(/post-visit page (created|reused)/i);
}

export function assertEoiSuccess(body: WebhookBody): void {
  expect(body.success).toBe(true);
  expect(body.linkToken).toBeTruthy();
  expect(body.eoiUrl).toBeTruthy();
  expect((body.message ?? '').toLowerCase()).toMatch(/eoi page (created|reused)/i);
}

/** No link of any kind was produced, and the message reads like a rejection. */
export function assertLinkFailure(body: WebhookBody): void {
  const producedLink =
    body.micrositeUrl || body.link_token || body.linkToken || body.postVisitUrl || body.eoiUrl;
  expect(producedLink).toBeFalsy();
  const text = `${body.message ?? ''} ${body.error ?? ''}`.toLowerCase();
  expect(text).toMatch(
    /fail|error|invalid|clarification|ambiguous|not found|permission denied|blocked|inactive|incomplete|missing|suspended|not accessible|not created|required/i
  );
}

/** Returns the produced link token/url for any link type, or undefined. */
export function extractLinkToken(body: WebhookBody): string | undefined {
  return body.linkToken ?? body.link_token ?? undefined;
}

/**
 * Extract the microsite id (last path segment) from a microsite public URL, e.g.
 *   https://dev.propfocus.in/propfocus-internal/arhan-092050CE6  ->  arhan-092050CE6
 * The GET /microsite/:id/events endpoint accepts this human token or a UUID.
 */
export function micrositeIdFromUrl(url: string): string {
  return url.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
}
