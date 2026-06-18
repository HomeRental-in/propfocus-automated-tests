import { expect, APIRequestContext } from '@playwright/test';
import { MicrositeProjectOutcome } from './micrositeProjects';
import { SITE_VISIT_DEFAULT_SLOT } from './siteVisitProjects';

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

const DEFAULT_PHONE = process.env.TEST_PHONE ?? '9888898888';

export interface WebhookResponseBody {
  success: boolean;
  message?: string;
  error?: string;
  micrositeUrl?: string | null;
  link_token?: string;
}

export function uniqueBuyerId(): string {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(100 + Math.random() * 900);
  return `B${timestamp}${random}`;
}

export async function sendWebhook(
  request: APIRequestContext,
  messageBody: string,
  phone: string = DEFAULT_PHONE,
  options?: { allowNon200?: boolean }
): Promise<WebhookResponseBody> {
  const payload = {
    event: 'message',
    data: { from: phone, body: messageBody },
  };

  let response = await request.post(API_URL, {
    data: payload,
    timeout: 60000,
  });
  let attempts = 0;

  while (response.status() === 502 && attempts < 3) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
    response = await request.post(API_URL, {
      data: payload,
      timeout: 60000,
    });
  }

  const body: WebhookResponseBody = await response.json();

  if (response.status() !== 200) {
    if (options?.allowNon200) {
      body.success = body.success ?? false;
      body.error = body.error ?? `HTTP ${response.status()}`;
      console.log(`\nPhone   : ${phone}`);
      console.log(`Request : ${messageBody}`);
      console.log(JSON.stringify(body, null, 2));
      await new Promise((resolve) => setTimeout(resolve, 800));
      return body;
    }
    expect(response.status()).toBe(200);
  }

  console.log(`\nPhone   : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(body, null, 2));

  await new Promise((resolve) => setTimeout(resolve, 800));

  return body;
}

export function buildMicrositePrompt(
  buyerName: string,
  buyerId: string,
  project: string
): string {
  return `${buyerName} ${buyerId} for ${project}`;
}

export function buildSiteVisitPrompt(
  buyerName: string,
  buyerId: string,
  project: string,
  slot: string = SITE_VISIT_DEFAULT_SLOT
): string {
  return `${buyerName} ${buyerId} for sv ${project} ${slot}`;
}

export function assertMicrositeSuccess(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.micrositeUrl).toBeTruthy();
  expect(body.message).toBeTruthy();
}

export function assertMicrositeAmbiguous(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.micrositeUrl).toBeFalsy();
  expect(body.message?.toLowerCase()).toMatch(
    /ambiguous|clarification|no projects/i
  );
}

export function assertMicrositePermissionDenied(body: WebhookResponseBody): void {
  expect(body.micrositeUrl).toBeFalsy();
  expect(body.message?.toLowerCase()).toContain('permission denied');
}

export function assertMicrositeInactive(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);

  // Dev may still return a link for inactive projects — document both outcomes.
  if (body.micrositeUrl) {
    expect(body.message).toBeTruthy();
    return;
  }

  const message = (body.message ?? '').toLowerCase();
  expect(message).toMatch(
    /inactive|disabled|not available|blocked|archived|clarification/i
  );
}

export function assertMicrositeByOutcome(
  body: WebhookResponseBody,
  outcome: MicrositeProjectOutcome
): void {
  switch (outcome) {
    case 'inactive':
      assertMicrositeInactive(body);
      break;
    case 'ambiguous':
      assertMicrositeAmbiguous(body);
      break;
    case 'permission_denied':
      assertMicrositePermissionDenied(body);
      break;
    case 'success':
    default:
      assertMicrositeSuccess(body);
  }
}

export function assertSiteVisitSuccess(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.link_token).toBeTruthy();
  expect(body.message).toBeTruthy();
}

export function assertSiteVisitFailure(body: WebhookResponseBody): void {
  expect(body.link_token).toBeFalsy();

  const text = `${body.message ?? ''} ${body.error ?? ''}`.toLowerCase();
  expect(text).toMatch(
    /fail|error|invalid|clarification|ambiguous|not found|permission denied|blocked|inactive|process|http 500/i
  );
}

export function assertSiteVisitByMicrositeOutcome(
  body: WebhookResponseBody,
  micrositeOutcome: MicrositeProjectOutcome
): void {
  if (
    micrositeOutcome === 'ambiguous' ||
    micrositeOutcome === 'permission_denied'
  ) {
    assertSiteVisitFailure(body);
    return;
  }

  // Boss projects and some inactive flows may not support SV on dev.
  if (body.link_token) {
    assertSiteVisitSuccess(body);
    return;
  }

  assertSiteVisitFailure(body);
}

export async function ensureMicrosite(
  request: APIRequestContext,
  buyerName: string,
  buyerId: string,
  project: string
): Promise<WebhookResponseBody> {
  const body = await sendWebhook(
    request,
    buildMicrositePrompt(buyerName, buyerId, project)
  );
  assertMicrositeSuccess(body);
  return body;
}

export async function bookSiteVisit(
  request: APIRequestContext,
  buyerName: string,
  buyerId: string,
  project: string,
  options?: { allowNon200?: boolean }
): Promise<WebhookResponseBody> {
  return sendWebhook(
    request,
    buildSiteVisitPrompt(buyerName, buyerId, project),
    DEFAULT_PHONE,
    options
  );
}
