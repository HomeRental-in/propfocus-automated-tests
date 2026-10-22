// ======================================================
// BUYER ID UPDATE FROM THE DASHBOARD
//
// Contract (confirmed against dev backend):
//   PATCH /api/dashboard/microsites/:id/buyer-id   { buyerId } -> { success, buyerId }
//   PATCH /api/dashboard/site-visits/:id/buyer-id  { buyerId } -> (same family)
//
// KNOWN BUG (2026-08-31): a PATCH whose body is missing `buyerId` (empty
// object, or a wrong key like `buyer_id`) returns success and silently NULLS
// the stored buyer id. BIDUP_02 pins the desired behavior (reject or no-op)
// and FAILS until the backend validates the payload — buyer ids are the
// PropFocus<->Salesforce linkage, so silent clearing is data loss.
// ======================================================
import { test, expect } from '@playwright/test';
import {
  API_BASE,
  DEFAULT_PHONE,
  postWebhook,
  uniqueBuyerId,
  uniqueBuyerName,
} from '../../utils/buyerLinks';
import { loginBroker } from '../../utils/dashboardApi';

test.describe('Dashboard buyer-id update', () => {
  let token: string;
  let micrositeId: string;
  let originalBuyerId: string;
  let buyerName: string;

  const auth = () => ({ headers: { Authorization: `Bearer ${token}` } });

  test.beforeAll(async ({ request }) => {
    ({ token } = await loginBroker(request, DEFAULT_PHONE));

    buyerName = uniqueBuyerName('Bidup');
    originalBuyerId = uniqueBuyerId('BU');
    const created = await postWebhook(request, `${buyerName} ${originalBuyerId} for Abhee Tranquila`);
    expect(created.success, `microsite create failed: ${created.message}`).toBe(true);

    const found = await request.get(
      `${API_BASE}/dashboard/microsites?search=${encodeURIComponent(buyerName)}`,
      auth()
    );
    const list = (await found.json())?.data?.microsites ?? [];
    expect(list.length, 'created microsite should be searchable').toBeGreaterThan(0);
    micrositeId = list[0].id;
  });

  async function currentBuyerId(request: import('@playwright/test').APIRequestContext) {
    const res = await request.get(
      `${API_BASE}/dashboard/microsites?search=${encodeURIComponent(buyerName)}`,
      auth()
    );
    return ((await res.json())?.data?.microsites ?? [])[0]?.buyerId ?? null;
  }

  test('BIDUP_01 - PATCH updates the buyer id and persists @sanity', async ({ request }) => {
    const newId = uniqueBuyerId('BU');
    const res = await request.patch(`${API_BASE}/dashboard/microsites/${micrositeId}/buyer-id`, {
      ...auth(),
      data: { buyerId: newId },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.buyerId).toBe(newId);
    expect(await currentBuyerId(request), 'update should persist').toBe(newId);
  });

  test('BIDUP_02 - PATCH without buyerId must not silently clear it @regression', async ({ request }) => {
    const before = await currentBuyerId(request);
    expect(before, 'precondition: lead should have a buyer id').toBeTruthy();

    const res = await request.patch(`${API_BASE}/dashboard/microsites/${micrositeId}/buyer-id`, {
      ...auth(),
      data: {},
    });

    const after = await currentBuyerId(request);
    const rejected = res.status() === 400;
    const unchanged = after === before;
    expect(
      rejected || unchanged,
      `a body without buyerId must be rejected or be a no-op — got HTTP ${res.status()} and buyerId ${before} -> ${after}`
    ).toBe(true);
  });

  test('BIDUP_03 - buyer-id update endpoints are auth-gated @security', async ({ request }) => {
    const ms = await request.patch(`${API_BASE}/dashboard/microsites/${micrositeId}/buyer-id`, {
      data: { buyerId: 'NOAUTH1' },
    });
    expect(ms.status(), 'microsite buyer-id update must require auth').toBe(401);

    const sv = await request.patch(`${API_BASE}/dashboard/site-visits/00000000-0000-0000-0000-000000000000/buyer-id`, {
      data: { buyerId: 'NOAUTH1' },
    });
    expect(sv.status(), 'site-visit buyer-id update must require auth').toBe(401);
  });
});
