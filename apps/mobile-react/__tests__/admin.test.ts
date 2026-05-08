/**
 * Admin & Operations dashboard feature tests
 *
 * Tests cover:
 *   - Admin dashboard loading (20 parallel API calls with Promise.allSettled)
 *   - Restaurant approvals
 *   - Driver onboarding admin (list, approve, reject)
 *   - Driver assignment (best driver AI, specific driver)
 *   - Order and payment monitoring
 *   - Live delivery tracking and driver load balancing
 *   - Zones, campaigns, offers, incentives creation
 *   - Analytics and demand prediction
 *   - Payout approvals
 *   - Support tickets
 *   - Audit logs and verification checks
 */

import { ApiClient } from "../src/api";

const BASE = "http://localhost:4000";
const TOKEN = "admin-jwt-token";

function makeClient() {
  return new ApiClient(BASE);
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

// ── Admin Dashboard Loading ───────────────────────────────────────────────────

describe("Admin dashboard loading (Promise.allSettled)", () => {
  test("loadAdmin fetches all 20 data sources in parallel", async () => {
    const client = makeClient();

    const dashboard = { users: 120, ordersByStatus: [{ status: "pending", count: 5 }, { status: "delivered", count: 85 }], revenuePaise: 5000000, payments: [], recentOrders: [] };

    const responses = [
      dashboard,
      [{ id: "rest-001", name: "Spice Garden", address: "Delhi", approval_status: "approved" }],
      [{ id: "user-001", phone: "+91999", email: null, name: "Ravi", role: "driver" }],
      [{ id: "order-001", status: "delivered", total_paise: 24900, restaurant_name: "Spice Garden" }],
      [{ provider: "paytm", status: "success", transactions: 50, amount_paise: 1245000 }],
      [{ id: "order-B", status: "picked_up", restaurant_name: "Pizza Hut", last_driver_lat: "28.61", last_driver_lng: "77.21" }],
      [{ id: "driver-001", phone: "+91999", name: "Ravi" }],
      [{ id: "driver-001", phone: "+91999", active_orders: 2, capacity_score: 0.7 }],
      [{ id: "zone-001", name: "Zone A", city: "Delhi NCR", sla_minutes: 20, surge_multiplier: "1.2" }],
      [{ id: "offer-001", code: "SAVE50", title: "Save ₹50", discount_type: "flat", discount_value: 5000 }],
      [{ id: "camp-001", name: "Launch Push", channel: "push", budget_paise: 100000, status: "active", ai_creative: null }],
      [{ id: "inc-001", title: "Weekly Bonus", target_deliveries: 50, reward_paise: 7500, status: "active" }],
      [{ id: "payout-001", amount_paise: 50000, method: "upi", status: "pending", phone: "+91999", role: "driver", created_at: "2026-05-08T10:00:00Z" }],
      [{ id: "ticket-1", category: "technical", subject: "App crash", status: "open", created_at: "2026-05-08T10:00:00Z" }],
      [{ id: "log-001", method: "POST", path: "/api/v1/orders", status_code: 201, created_at: "2026-05-08T10:00:00Z" }],
      [{ id: "check-001", provider: "azure", check_type: "ocr", status: "success", created_at: "2026-05-08T10:00:00Z" }],
      [{ id: "job-001", job_type: "demand_prediction", status: "complete", summary: {}, created_at: "2026-05-08T10:00:00Z" }],
      [{ id: "pred-001", zone_key: "delhi-ncr", cuisine_type: "North Indian", hour_start: "2026-05-08T12:00:00Z", predicted_orders: 150, confidence: "high" }],
      [{ id: "app-001", full_name: "Ravi Kumar", phone: "+91999", aadhaar_last4: "1234", ocr_status: "success", selfie_status: "success", background_check_status: "clear", bank_account_last4: "5678", upi_id: "ravi@upi", referral_code: "DRV123", approval_status: "pending", admin_note: null }],
      [{ id: "ref-001", referral_code: "DRV123", status: "pending", reward_paise: 50000, referrer_phone: "+91999", referred_phone: "+91888", created_at: "2026-05-08T10:00:00Z" }],
    ];

    responses.forEach(r => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(r) });
    });

    const results = await Promise.allSettled([
      client.adminDashboard(TOKEN),
      client.adminRestaurants(TOKEN),
      client.adminUsers(TOKEN),
      client.adminAllOrders(TOKEN),
      client.paymentReports(TOKEN),
      client.deliveryAdminOrders(TOKEN),
      client.deliveryDrivers(TOKEN),
      client.driverLoadBalancing(TOKEN),
      client.marketplaceZones(TOKEN),
      client.marketplaceOffers(TOKEN),
      client.campaigns(TOKEN),
      client.driverIncentives(TOKEN),
      client.adminPayouts(TOKEN),
      client.supportTickets(TOKEN),
      client.auditLogs(TOKEN),
      client.verificationChecks(TOKEN),
      client.analyticsJobs(TOKEN),
      client.demandPredictions(TOKEN),
      client.driverOnboardingApplications(TOKEN),
      client.driverReferrals(TOKEN),
    ]);

    expect(results).toHaveLength(20);
    const fulfilled = results.filter(r => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(20);

    const dashboardResult = (results[0] as PromiseFulfilledResult<typeof dashboard>).value;
    expect(dashboardResult.users).toBe(120);
    expect(dashboardResult.ordersByStatus).toHaveLength(2);
  });

  test("loadAdmin is resilient: partial failures do not prevent other data from loading", async () => {
    const client = makeClient();

    fetchMock
      .mockRejectedValueOnce(new Error("Dashboard service down"))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([{ id: "rest-001", name: "Spice Garden", address: "Delhi", approval_status: "pending" }]) })
      .mockRejectedValueOnce(new Error("Users service down"));

    const results = await Promise.allSettled([
      client.adminDashboard(TOKEN),
      client.adminRestaurants(TOKEN),
      client.adminUsers(TOKEN),
    ]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");
    expect(results[2].status).toBe("rejected");

    const ok = <T,>(r: PromiseSettledResult<T>, fallback: T): T => r.status === "fulfilled" ? r.value : fallback;
    const restaurants = ok(results[1] as PromiseSettledResult<Array<{ id: string; name: string }>>, []);
    expect(restaurants).toHaveLength(1);
  });

  test("dashboard stats banner shows correct KPIs", () => {
    const dashboard = { users: 120, ordersByStatus: [{ status: "pending", count: 5 }, { status: "delivered", count: 85 }], revenuePaise: 5000000, payments: [], recentOrders: [] };
    const adminRestaurants = [{ id: "rest-001" }, { id: "rest-002" }];
    const adminOrders = [{ id: "order-001" }, { id: "order-002" }, { id: "order-003" }];
    const driverLoad = [{ id: "driver-001" }, { id: "driver-002" }];

    expect(dashboard.users).toBe(120);
    expect(adminRestaurants.length).toBe(2);
    expect(adminOrders.length).toBe(3);
    expect(driverLoad.length).toBe(2);
    expect(dashboard.revenuePaise / 100).toBe(50000);
  });
});

// ── Restaurant Approvals ──────────────────────────────────────────────────────

describe("Admin restaurant approvals", () => {
  test("approve restaurant patches status=approved", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "rest-001", approval_status: "approved" }) });

    await client.updateRestaurantApproval(TOKEN, "rest-001", "approved");
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/admin/restaurants/rest-001/approval");
    expect(body.status).toBe("approved");
  });

  test("reject restaurant patches status=rejected", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "rest-001", approval_status: "rejected" }) });

    await client.updateRestaurantApproval(TOKEN, "rest-001", "rejected");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.status).toBe("rejected");
  });

  test("optimistic UI update: approval_status changes in local list", () => {
    const restaurants = [
      { id: "rest-001", name: "Spice Garden", address: "Delhi", approval_status: "pending" },
      { id: "rest-002", name: "Burger Bistro", address: "Mumbai", approval_status: "pending" },
    ];

    const updated = restaurants.map(r => r.id === "rest-001" ? { ...r, approval_status: "approved" } : r);
    expect(updated[0].approval_status).toBe("approved");
    expect(updated[1].approval_status).toBe("pending");
  });
});

// ── Driver Onboarding Admin ───────────────────────────────────────────────────

describe("Admin driver onboarding management", () => {
  test("driverOnboardingApplications fetches pending applications", async () => {
    const client = makeClient();
    const apps = [
      { id: "app-001", full_name: "Ravi Kumar", phone: "+919999000003", aadhaar_last4: "1234", ocr_status: "success", selfie_status: "success", background_check_status: "clear", bank_account_last4: "5678", upi_id: "ravi@upi", referral_code: "DRV123", approval_status: "pending", admin_note: null },
      { id: "app-002", full_name: "Priya Singh", phone: "+919999000005", aadhaar_last4: "5678", ocr_status: "pending", selfie_status: "pending", background_check_status: "pending", bank_account_last4: null, upi_id: null, referral_code: null, approval_status: "pending", admin_note: null },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(apps) });

    const result = await client.driverOnboardingApplications(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].full_name).toBe("Ravi Kumar");
  });

  test("approve driver application patches status=approved with note", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "app-001", approval_status: "approved" }) });

    await client.updateDriverApplicationApproval(TOKEN, "app-001", "approved", "Approved from AK Ops mobile");
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/driver-onboarding/admin/applications/app-001/approval");
    expect(body).toEqual({ status: "approved", note: "Approved from AK Ops mobile" });
  });

  test("reject driver application patches status=rejected with note", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "app-002", approval_status: "rejected" }) });

    await client.updateDriverApplicationApproval(TOKEN, "app-002", "rejected", "Documents unclear");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ status: "rejected", note: "Documents unclear" });
  });

  test("optimistic UI update for driver application approval", () => {
    const applications = [
      { id: "app-001", full_name: "Ravi Kumar", approval_status: "pending" },
      { id: "app-002", full_name: "Priya Singh", approval_status: "pending" },
    ];

    const updated = applications.map(a => a.id === "app-001" ? { ...a, approval_status: "approved" } : a);
    expect(updated[0].approval_status).toBe("approved");
    expect(updated[1].approval_status).toBe("pending");
  });

  test("driverReferrals fetches referral list with rewards", async () => {
    const client = makeClient();
    const referrals = [
      { id: "ref-001", referral_code: "DRV123", status: "pending", reward_paise: 50000, referrer_phone: "+91999", referred_phone: "+91888", created_at: "2026-05-08T10:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(referrals) });

    const result = await client.driverReferrals(TOKEN);
    expect(result[0].referral_code).toBe("DRV123");
    expect(result[0].reward_paise).toBe(50000);
  });
});

// ── Driver Assignment ──────────────────────────────────────────────────────────

describe("Admin driver assignment", () => {
  test("assignBestDriver calls AI assignment endpoint", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ driverId: "driver-best", message: "Best driver assigned" }) });

    await client.assignBestDriver(TOKEN, "order-001");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/operations/orders/order-001/assign-best-driver");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  test("assignDriver patches specific driver to order", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ assigned: true }) });

    await client.assignDriver(TOKEN, "order-001", "driver-001");
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/delivery-admin/orders/order-001/assign-driver");
    expect(body.driverId).toBe("driver-001");
  });

  test("Assign First Available picks first driver from deliveryDrivers list", () => {
    const deliveryDrivers = [
      { id: "driver-001", phone: "+91999", name: "Ravi Kumar" },
      { id: "driver-002", phone: "+91888", name: "Priya Singh" },
    ];
    const firstDriver = deliveryDrivers[0];
    expect(firstDriver.id).toBe("driver-001");
  });
});

// ── Live Tracking & Driver Load ───────────────────────────────────────────────

describe("Live tracking and driver load balancing", () => {
  test("deliveryAdminOrders returns live orders with driver coordinates", async () => {
    const client = makeClient();
    const orders = [
      { id: "order-A", status: "picked_up", restaurant_name: "Pizza Hut", last_driver_lat: "28.61", last_driver_lng: "77.21" },
      { id: "order-B", status: "assigned", restaurant_name: "Burger King", last_driver_lat: null, last_driver_lng: null },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(orders) });

    const result = await client.deliveryAdminOrders(TOKEN);
    const withLocation = result.filter(o => o.last_driver_lat !== null);
    const withoutLocation = result.filter(o => o.last_driver_lat === null);
    expect(withLocation).toHaveLength(1);
    expect(withoutLocation).toHaveLength(1);
  });

  test("driverLoadBalancing returns capacity scores", async () => {
    const client = makeClient();
    const load = [
      { id: "driver-001", phone: "+91999", active_orders: 2, capacity_score: 0.7 },
      { id: "driver-002", phone: "+91888", active_orders: 0, capacity_score: 1.0 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(load) });

    const result = await client.driverLoadBalancing(TOKEN);
    const available = result.filter(d => d.active_orders === 0);
    expect(available).toHaveLength(1);
    expect(available[0].capacity_score).toBe(1.0);
  });

  test("driver location display shows coordinates or unavailable message", () => {
    const ordersWithLocation = [
      { id: "order-A", last_driver_lat: "28.61", last_driver_lng: "77.21" },
      { id: "order-B", last_driver_lat: null, last_driver_lng: null },
    ];

    ordersWithLocation.forEach(order => {
      const locationDisplay = order.last_driver_lat
        ? `Driver at ${order.last_driver_lat}, ${order.last_driver_lng}`
        : "Driver location not available";

      if (order.id === "order-A") {
        expect(locationDisplay).toContain("28.61");
      } else {
        expect(locationDisplay).toBe("Driver location not available");
      }
    });
  });
});

// ── Analytics & Demand Prediction ────────────────────────────────────────────

describe("Analytics and demand prediction", () => {
  test("runDemandPredictionJob posts to analytics jobs endpoint", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ predictions: [{ zone: "delhi-ncr", predicted: 150 }] }) });

    const result = await client.runDemandPredictionJob(TOKEN);
    expect(fetchMock.mock.calls[0][0]).toContain("/operations/analytics/jobs/demand-prediction");
    expect(result).toMatchObject({ predictions: expect.any(Array) });
  });

  test("analyticsJobs fetches all ML job executions", async () => {
    const client = makeClient();
    const jobs = [
      { id: "job-001", job_type: "demand_prediction", status: "complete", summary: { zones: 5 }, created_at: "2026-05-08T10:00:00Z" },
      { id: "job-002", job_type: "driver_scoring", status: "running", summary: {}, created_at: "2026-05-08T11:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(jobs) });

    const result = await client.analyticsJobs(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("complete");
  });

  test("demandPredictions returns zoned predictions with confidence", async () => {
    const client = makeClient();
    const predictions = [
      { id: "pred-001", zone_key: "delhi-ncr", cuisine_type: "North Indian", hour_start: "2026-05-08T12:00:00Z", predicted_orders: 150, confidence: "high" },
      { id: "pred-002", zone_key: "gurgaon", cuisine_type: null, hour_start: "2026-05-08T13:00:00Z", predicted_orders: 80, confidence: "medium" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(predictions) });

    const result = await client.demandPredictions(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].predicted_orders).toBe(150);
    expect(result[1].cuisine_type).toBeNull();
  });
});

// ── Zones, Campaigns, Offers, Incentives ──────────────────────────────────────

describe("Admin marketplace configuration", () => {
  test("createZone generates unique name with timestamp suffix", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "zone-new" }) });

    const zoneName = `Zone ${Date.now().toString(36).slice(-4).toUpperCase()}`;
    await client.createZone(TOKEN, zoneName, "Delhi NCR", 28.6139, 77.209, 3, 20);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toContain("Zone ");
    expect(body.city).toBe("Delhi NCR");
    expect(body.slaMinutes).toBe(20);
    expect(body.radiusKm).toBe(3);
  });

  test("createOffer generates unique coupon code", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "offer-new" }) });

    const code = `MOB${Date.now().toString(36).slice(-5).toUpperCase()}`;
    await client.createOffer(TOKEN, code, "Mobile Offer", "flat", 5000, 19900);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.code).toContain("MOB");
    expect(body.discountType).toBe("flat");
    expect(body.discountValue).toBe(5000);
    expect(body.minOrderPaise).toBe(19900);
  });

  test("createCampaign with AI creative posts channel and budget", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "camp-new" }) });

    const name = `Campaign ${Date.now().toString(36).slice(-4).toUpperCase()}`;
    await client.createCampaign(TOKEN, name, "push", 100000, "AI mobile launch creative");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.channel).toBe("push");
    expect(body.budgetPaise).toBe(100000);
    expect(body.aiCreative).toBe("AI mobile launch creative");
  });

  test("createDriverIncentive posts delivery target and reward", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "inc-new" }) });

    const title = `Delivery Bonus ${Date.now().toString(36).slice(-4).toUpperCase()}`;
    await client.createDriverIncentive(TOKEN, title, 5, 7500);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.targetDeliveries).toBe(5);
    expect(body.rewardPaise).toBe(7500);
  });

  test("marketplaceZones returns zones with SLA and surge info", async () => {
    const client = makeClient();
    const zones = [
      { id: "zone-001", name: "Zone A", city: "Delhi NCR", sla_minutes: 20, surge_multiplier: "1.2" },
      { id: "zone-002", name: "Zone B", city: "Mumbai", sla_minutes: 25, surge_multiplier: "1.5" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(zones) });

    const result = await client.marketplaceZones(TOKEN);
    expect(result[0].sla_minutes).toBe(20);
    expect(Number(result[1].surge_multiplier)).toBe(1.5);
  });
});

// ── Payout Approvals ──────────────────────────────────────────────────────────

describe("Admin payout approvals", () => {
  test("adminPayouts fetches all pending payouts for drivers and restaurants", async () => {
    const client = makeClient();
    const payouts = [
      { id: "payout-001", amount_paise: 50000, method: "upi", status: "pending", phone: "+919999000003", role: "driver", created_at: "2026-05-08T10:00:00Z" },
      { id: "payout-002", amount_paise: 150000, method: "bank", status: "pending", phone: "+919999000002", role: "restaurant", created_at: "2026-05-08T11:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(payouts) });

    const result = await client.adminPayouts(TOKEN);
    const driverPayouts = result.filter(p => p.role === "driver");
    const restaurantPayouts = result.filter(p => p.role === "restaurant");
    expect(driverPayouts).toHaveLength(1);
    expect(restaurantPayouts).toHaveLength(1);
  });

  test("approve payout patches status=approved with note", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-001", status: "approved" }) });

    await client.updatePayoutApproval(TOKEN, "payout-001", "approved", "Approved from AK Ops mobile");
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/wallet/payouts/payout-001/approval");
    expect(body.status).toBe("approved");
    expect(body.note).toBe("Approved from AK Ops mobile");
  });

  test("mark payout as paid patches status=paid", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-001", status: "paid" }) });

    await client.updatePayoutApproval(TOKEN, "payout-001", "paid");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.status).toBe("paid");
  });

  test("reject payout patches status=rejected", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-001", status: "rejected" }) });

    await client.updatePayoutApproval(TOKEN, "payout-001", "rejected", "Fraudulent request");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.status).toBe("rejected");
    expect(body.note).toBe("Fraudulent request");
  });

  test("optimistic UI update removes approved payout from pending list", () => {
    const payouts = [
      { id: "payout-001", status: "pending", role: "driver" },
      { id: "payout-002", status: "pending", role: "restaurant" },
    ];

    const updated = payouts.map(p => p.id === "payout-001" ? { ...p, status: "approved" } : p);
    const stillPending = updated.filter(p => p.status === "pending");
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].id).toBe("payout-002");
  });
});

// ── Support Tickets ───────────────────────────────────────────────────────────

describe("Admin support tickets", () => {
  test("createSupportTicket posts test ticket from admin", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-new" }) });

    await client.createSupportTicket(TOKEN, "technical", "Mobile test ticket", "Test ticket created from AK Ops mobile app.");
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/marketplace/support/tickets");
    expect(body.category).toBe("technical");
    expect(body.subject).toBe("Mobile test ticket");
    expect(body.message).toContain("Test ticket");
  });

  test("supportTickets lists all tickets with status", async () => {
    const client = makeClient();
    const tickets = [
      { id: "ticket-1", category: "technical", subject: "App crash", status: "open", created_at: "2026-05-08T10:00:00Z" },
      { id: "ticket-2", category: "billing", subject: "Wrong charge", status: "resolved", created_at: "2026-05-08T09:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(tickets) });

    const result = await client.supportTickets(TOKEN);
    const open = result.filter(t => t.status === "open");
    const resolved = result.filter(t => t.status === "resolved");
    expect(open).toHaveLength(1);
    expect(resolved).toHaveLength(1);
  });
});

// ── Audit Logs & Security ─────────────────────────────────────────────────────

describe("Audit logs and security verification", () => {
  test("auditLogs returns HTTP method, path, and status code", async () => {
    const client = makeClient();
    const logs = [
      { id: "log-001", method: "POST", path: "/api/v1/orders", status_code: 201, created_at: "2026-05-08T10:00:00Z" },
      { id: "log-002", method: "GET", path: "/api/v1/admin/dashboard", status_code: 200, created_at: "2026-05-08T10:01:00Z" },
      { id: "log-003", method: "PATCH", path: "/api/v1/orders/order-001/status", status_code: 200, created_at: "2026-05-08T10:02:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(logs) });

    const result = await client.auditLogs(TOKEN);
    expect(result).toHaveLength(3);
    const methods = result.map(l => l.method);
    expect(methods).toContain("POST");
    expect(methods).toContain("GET");
    expect(methods).toContain("PATCH");
  });

  test("verificationChecks returns provider, type, and status", async () => {
    const client = makeClient();
    const checks = [
      { id: "check-001", provider: "azure", check_type: "ocr", status: "success", created_at: "2026-05-08T10:00:00Z" },
      { id: "check-002", provider: "azure", check_type: "face", status: "success", created_at: "2026-05-08T10:01:00Z" },
      { id: "check-003", provider: "third_party", check_type: "background", status: "pending", created_at: "2026-05-08T10:02:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(checks) });

    const result = await client.verificationChecks(TOKEN);
    const ocrChecks = result.filter(c => c.check_type === "ocr");
    const faceChecks = result.filter(c => c.check_type === "face");
    expect(ocrChecks).toHaveLength(1);
    expect(faceChecks).toHaveLength(1);
    expect(result[2].status).toBe("pending");
  });
});

// ── Payment Reports ───────────────────────────────────────────────────────────

describe("Admin payment reports", () => {
  test("paymentReports returns provider stats grouped by status", async () => {
    const client = makeClient();
    const reports = [
      { provider: "paytm", status: "success", transactions: 50, amount_paise: 1245000 },
      { provider: "paytm", status: "failed", transactions: 3, amount_paise: 0 },
      { provider: "phonepe", status: "success", transactions: 30, amount_paise: 750000 },
      { provider: "razorpay", status: "success", transactions: 20, amount_paise: 500000 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(reports) });

    const result = await client.paymentReports(TOKEN);
    const totalSuccessful = result
      .filter(r => r.status === "success")
      .reduce((acc, r) => acc + r.transactions, 0);
    expect(totalSuccessful).toBe(100);

    const providers = [...new Set(result.map(r => r.provider))];
    expect(providers).toContain("paytm");
    expect(providers).toContain("phonepe");
    expect(providers).toContain("razorpay");
  });
});

// ── Order Monitoring ──────────────────────────────────────────────────────────

describe("Admin order monitoring", () => {
  test("adminAllOrders returns all orders with status breakdown", async () => {
    const client = makeClient();
    const orders = [
      { id: "order-001", status: "delivered", total_paise: 24900, restaurant_name: "Spice Garden" },
      { id: "order-002", status: "pending", total_paise: 34900, restaurant_name: "Burger King" },
      { id: "order-003", status: "cancelled", total_paise: 19900, restaurant_name: "Pizza Hut" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(orders) });

    const result = await client.adminAllOrders(TOKEN);
    const delivered = result.filter(o => o.status === "delivered");
    const pending = result.filter(o => o.status === "pending");
    const cancelled = result.filter(o => o.status === "cancelled");
    expect(delivered).toHaveLength(1);
    expect(pending).toHaveLength(1);
    expect(cancelled).toHaveLength(1);
  });

  test("dashboard ordersByStatus displays correct counts", () => {
    const ordersByStatus = [
      { status: "pending", count: 5 },
      { status: "accepted", count: 12 },
      { status: "picked_up", count: 8 },
      { status: "delivered", count: 85 },
      { status: "cancelled", count: 3 },
    ];

    const totalOrders = ordersByStatus.reduce((acc, s) => acc + s.count, 0);
    expect(totalOrders).toBe(113);

    const deliveredCount = ordersByStatus.find(s => s.status === "delivered")?.count ?? 0;
    expect(deliveredCount).toBe(85);
  });

  test("adminUsers returns user list with roles", async () => {
    const client = makeClient();
    const users = [
      { id: "user-001", phone: "+919999000003", email: null, name: "Ravi Kumar", role: "driver" },
      { id: "user-002", phone: "+919999000002", email: null, name: "Spice Garden", role: "restaurant" },
      { id: "user-003", phone: "+919999000004", email: "admin@amberkitchen.com", name: "Admin User", role: "admin" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(users) });

    const result = await client.adminUsers(TOKEN);
    const drivers = result.filter(u => u.role === "driver");
    const admins = result.filter(u => u.role === "admin");
    expect(drivers).toHaveLength(1);
    expect(admins).toHaveLength(1);
  });
});
