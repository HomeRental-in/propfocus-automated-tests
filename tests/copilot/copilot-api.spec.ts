import { test, expect, APIRequestContext } from "@playwright/test";
import { loginBroker } from "../../utils/dashboardApi";
import { API_BASE, DEFAULT_PHONE } from "../../utils/buyerLinks";

/**
 * Copilot chatbot API (backend routes/aiSearch.js):
 *   POST /dashboard/copilot            { query, conversation_id? } -> data.answer / conversationId / clarification / leads / pendingAction
 *   GET  /dashboard/copilot/suggestions
 *   POST /dashboard/ai-search          (legacy alias, same handler)
 *   GET  /dashboard/ai-search/suggestions
 *
 * Covers the contract the question-sweep (ai-search-api.spec.ts) doesn't:
 * suggestions, conversation continuity, legacy-alias parity, auth, validation.
 */

async function authCtx(request: APIRequestContext, token: string) {
  return {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
}

test.describe("Copilot chatbot — API", () => {
  let token: string;

  test.beforeAll(async ({ playwright }) => {
    const rq = await playwright.request.newContext();
    ({ token } = await loginBroker(rq, DEFAULT_PHONE));
    await rq.dispose();
    expect(token, "login must yield a token").toBeTruthy();
  });

  test("TC_COPILOT_API_01 - suggestions endpoint returns a list @sanity", async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard/copilot/suggestions`, await authCtx(request, token));
    expect(res.status()).toBe(200);
    const body = await res.json();
    const suggestions = body?.suggestions ?? body?.data?.suggestions;
    expect(Array.isArray(suggestions)).toBe(true);
  });

  test("TC_COPILOT_API_02 - a query returns an answer + conversationId @sanity", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/dashboard/copilot`, {
      ...(await authCtx(request, token)),
      data: { query: "How many microsites have I created?" },
      timeout: 120_000,
    });
    expect(res.status()).toBe(200);
    const data = (await res.json())?.data;
    expect(typeof data?.answer).toBe("string");
    expect(data?.answer.length).toBeGreaterThan(0);
    expect(data?.conversationId, "should mint a conversationId").toBeTruthy();
  });

  test("TC_COPILOT_API_03 - conversation_id is preserved across turns @regression", async ({
    request,
  }) => {
    const first = await request.post(`${API_BASE}/dashboard/copilot`, {
      ...(await authCtx(request, token)),
      data: { query: "Show me my engaged leads" },
      timeout: 120_000,
    });
    const convId = (await first.json())?.data?.conversationId;
    test.skip(!convId, "backend did not return a conversationId to continue");

    const second = await request.post(`${API_BASE}/dashboard/copilot`, {
      ...(await authCtx(request, token)),
      data: { query: "and how many of those booked a site visit?", conversation_id: convId },
      timeout: 120_000,
    });
    expect(second.status()).toBe(200);
    expect((await second.json())?.data?.conversationId).toBe(convId);
  });

  test("TC_COPILOT_API_04 - legacy /ai-search alias still works @regression", async ({ request }) => {
    const res = await request.post(`${API_BASE}/dashboard/ai-search`, {
      ...(await authCtx(request, token)),
      data: { query: "hello", conversation_id: "test-alias" },
      timeout: 120_000,
    });
    expect(res.status()).toBe(200);
    expect(typeof (await res.json())?.data?.answer).toBe("string");

    const sugg = await request.get(`${API_BASE}/dashboard/ai-search/suggestions`, await authCtx(request, token));
    expect(sugg.status()).toBe(200);
  });

  test("TC_COPILOT_API_05 - empty and script queries are rejected @security", async ({ request }) => {
    const empty = await request.post(`${API_BASE}/dashboard/copilot`, {
      ...(await authCtx(request, token)),
      data: { query: "" },
    });
    expect(empty.status()).toBe(400);

    const xss = await request.post(`${API_BASE}/dashboard/copilot`, {
      ...(await authCtx(request, token)),
      data: { query: "<script>alert(1)</script>" },
    });
    expect(xss.status()).toBe(400);
  });

  test("TC_COPILOT_API_06 - requires authentication @security", async ({ request }) => {
    const res = await request.post(`${API_BASE}/dashboard/copilot`, {
      headers: { "Content-Type": "application/json" },
      data: { query: "hello" },
    });
    expect(res.status()).toBe(401);
  });
});
