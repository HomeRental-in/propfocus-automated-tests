import { expect, APIRequestContext } from '@playwright/test';

const API_URL =
  process.env.API_URL ??
  'https://dev.propfocus.in/api/whatsapp-webhook';

export interface WebhookResponseBody {
  success: boolean;
  message: string;
  micrositeUrl?: string | null;
  link_token?: string;
  imageURL?: string | null;
}

export function uniqueBuyerId(): string {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(100 + Math.random() * 900);
  return `B${timestamp}${random}`;
}

export async function sendBrokerWebhook(
  request: APIRequestContext,
  messageBody: string,
  phone: string
): Promise<WebhookResponseBody> {
  const payload = {
    data: {
      event: 'message',
      data: { from: phone, body: messageBody },
    },
  };

  let response = await request.post(API_URL, payload);
  let attempts = 0;

  while (response.status() === 502 && attempts < 3) {
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
    response = await request.post(API_URL, payload);
  }

  expect(response.status()).toBe(200);

  const responseBody: WebhookResponseBody = await response.json();

  console.log(`\nBroker  : ${phone}`);
  console.log(`Request : ${messageBody}`);
  console.log(JSON.stringify(responseBody, null, 2));

  await new Promise((resolve) => setTimeout(resolve, 600));

  return responseBody;
}

export function assertMicrositeAllowed(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.micrositeUrl).toBeTruthy();
  expect(body.message).toBeTruthy();
}

export function assertMicrositeBlocked(body: WebhookResponseBody): void {
  expect(body.micrositeUrl).toBeFalsy();

  const message = body.message.toLowerCase();
  const isBlocked =
    message.includes('inactive') ||
    message.includes('suspended') ||
    message.includes('blocked') ||
    message.includes('permission denied') ||
    message.includes('not found');

  expect(
    isBlocked,
    `Expected broker to be blocked, got: ${body.message}`
  ).toBe(true);
}

export function assertSiteVisitAllowed(body: WebhookResponseBody): void {
  expect(body.success).toBe(true);
  expect(body.link_token).toBeTruthy();
  expect(body.message).toBeTruthy();
}

export function assertSiteVisitBlocked(body: WebhookResponseBody): void {
  expect(body.link_token).toBeFalsy();

  const message = body.message.toLowerCase();
  const isBlocked =
    message.includes('inactive') ||
    message.includes('suspended') ||
    message.includes('blocked') ||
    message.includes('permission denied') ||
    message.includes('invalid') ||
    message.includes('clarification') ||
    message.includes('not found');

  expect(
    isBlocked,
    `Expected site visit to be blocked, got: ${body.message}`
  ).toBe(true);
}

export async function ensureMicrositeForBroker(
  request: APIRequestContext,
  phone: string,
  buyerName: string,
  buyerId: string,
  projectName: string
): Promise<WebhookResponseBody> {
  const body = await sendBrokerWebhook(
    request,
    `${buyerName} ${buyerId} for ${projectName}`,
    phone
  );
  assertMicrositeAllowed(body);
  return body;
}

export async function bookSiteVisitForBroker(
  request: APIRequestContext,
  phone: string,
  prompt: string
): Promise<WebhookResponseBody> {
  return sendBrokerWebhook(request, prompt, phone);
}
