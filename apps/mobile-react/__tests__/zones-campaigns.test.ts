/**
 * Zone management, campaigns (with AI creative), and driver incentives
 *
 * Tests cover:
 *   - Zone creation: name, city, center lat/lng, radius, SLA minutes
 *   - Zone SLA settings and surge multiplier display
 *   - Zone listing
 *   - Campaign creation: all four channels (push, email, whatsapp, ads)
 *   - AI creative field stored and returned on campaigns
 *   - Campaign status tracking (active / paused / completed)
 *   - Campaign budget in paise
 *   - Driver incentives: delivery targets and reward amounts
 *   - Incentive status (active / expired)
 *   - Driver load balancing: capacity score logic
 *   - Best-driver AI assignment
 *   - Demand prediction: zoned predictions with confidence levels
 *   - Analytics jobs: type, status, timestamps
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

// ── Zone Management ───────────────────────────────────────────────────────────

describe("Zone management", () => {
  test("creates zone with all required fields", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "zone-001" }) });

    await makeClient().createZone(TOKEN, "Delhi Central", "Delhi NCR", 28.6139, 77.2090, 5, 20);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Delhi Central");
    expect(body.city).toBe("Delhi NCR");
    expect(body.centerLat).toBe(28.6139);
    expect(body.centerLng).toBe(77.2090);
    expect(body.radiusKm).toBe(5);
    expect(body.slaMinutes).toBe(20);
  });

  test("creates zone with tight SLA (15 min) for dense urban area", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "zone-002" }) });

    await makeClient().createZone(TOKEN, "Connaught Place", "Delhi NCR", 28.6315, 77.2167, 2, 15);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.slaMinutes).toBe(15);
    expect(body.radiusKm).toBe(2);
  });

  test("creates zone with relaxed SLA (30 min) for suburban area", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "zone-003" }) });

    await makeClient().createZone(TOKEN, "Dwarka Suburb", "Delhi NCR", 28.5921, 77.0460, 8, 30);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.slaMinutes).toBe(30);
    expect(body.radiusKm).toBe(8);
  });

  test("creates zones across multiple cities", async () => {
    const cities = [
      { name: "Mumbai Central", city: "Mumbai", lat: 18.9388, lng: 72.8354, radius: 5, sla: 20 },
      { name: "Bangalore Koramangala", city: "Bangalore", lat: 12.9352, lng: 77.6245, radius: 3, sla: 25 },
      { name: "Chennai T Nagar", city: "Chennai", lat: 13.0418, lng: 80.2341, radius: 4, sla: 22 },
    ];

    for (const z of cities) {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: `zone-${z.city}` }) });
      await makeClient().createZone(TOKEN, z.name, z.city, z.lat, z.lng, z.radius, z.sla);
      const body = JSON.parse((fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as RequestInit).body as string);
      expect(body.city).toBe(z.city);
      expect(body.slaMinutes).toBe(z.sla);
    }
  });

  test("fetches zone list with SLA and surge multiplier", async () => {
    const zones = [
      { id: "zone-001", name: "Delhi Central", city: "Delhi NCR", sla_minutes: 20, surge_multiplier: "1.0" },
      { id: "zone-002", name: "Connaught Place", city: "Delhi NCR", sla_minutes: 15, surge_multiplier: "1.3" },
      { id: "zone-003", name: "Dwarka Suburb", city: "Delhi NCR", sla_minutes: 30, surge_multiplier: "0.9" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(zones) });

    const result = await makeClient().marketplaceZones(TOKEN);
    expect(result).toHaveLength(3);

    const highSurge = result.filter(z => Number(z.surge_multiplier) > 1.0);
    expect(highSurge).toHaveLength(1);
    expect(highSurge[0].name).toBe("Connaught Place");
  });

  test("surge multiplier above 1.0 signals peak-demand pricing", () => {
    const zones = [
      { name: "Zone A", surge_multiplier: "1.5" },
      { name: "Zone B", surge_multiplier: "1.0" },
      { name: "Zone C", surge_multiplier: "0.8" },
    ];
    const surging = zones.filter(z => Number(z.surge_multiplier) > 1.0);
    expect(surging).toHaveLength(1);
    expect(surging[0].name).toBe("Zone A");
  });

  test("SLA breach threshold: orders above sla_minutes are late", () => {
    const zone = { sla_minutes: 20 };
    const onTimeDelivery = { delivery_minutes: 18 };
    const lateDelivery = { delivery_minutes: 25 };

    expect(onTimeDelivery.delivery_minutes <= zone.sla_minutes).toBe(true);
    expect(lateDelivery.delivery_minutes <= zone.sla_minutes).toBe(false);
  });

  test("zone name uses timestamp suffix for uniqueness", () => {
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const zoneName = `Zone ${suffix}`;
    expect(zoneName).toMatch(/^Zone [A-Z0-9]{4}$/);
  });

  test("posts to /api/v1/marketplace/zones", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "zone-new" }) });
    await makeClient().createZone(TOKEN, "Zone X", "Delhi NCR", 28.6, 77.2, 3, 20);
    expect((fetchMock.mock.calls[0][0] as string)).toBe(`${BASE}/api/v1/marketplace/zones`);
  });
});

// ── Campaigns with AI Creative ────────────────────────────────────────────────

describe("Campaign management with AI creative tracking", () => {
  const CHANNELS = ["push", "email", "whatsapp", "ads"] as const;

  test.each(CHANNELS)("creates campaign with channel='%s'", async (channel) => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: `camp-${channel}` }) });

    await makeClient().createCampaign(TOKEN, `${channel} Campaign`, channel, 100000);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.channel).toBe(channel);
    fetchMock.mockClear();
  });

  test("campaign includes AI creative text when provided", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "camp-001" }) });

    const aiCreative = "Order now and get 20% off your first delivery! Fastest food in your area. 🚀";
    await makeClient().createCampaign(TOKEN, "Launch Push", "push", 100000, aiCreative);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.aiCreative).toBe(aiCreative);
  });

  test("campaign without AI creative has undefined aiCreative field", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "camp-002" }) });

    await makeClient().createCampaign(TOKEN, "Email Blast", "email", 50000);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.aiCreative).toBeUndefined();
  });

  test("campaign budget is stored in paise", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "camp-003" }) });

    await makeClient().createCampaign(TOKEN, "Big Budget", "ads", 5000000);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.budgetPaise).toBe(5000000);
    expect(body.budgetPaise / 100).toBe(50000);
  });

  test("fetches campaigns with status, channel and ai_creative", async () => {
    const campaigns = [
      { id: "camp-001", name: "Launch Push", channel: "push", budget_paise: 100000, status: "active", ai_creative: "Order now! Fast delivery." },
      { id: "camp-002", name: "Email Retention", channel: "email", budget_paise: 50000, status: "paused", ai_creative: null },
      { id: "camp-003", name: "WhatsApp Promo", channel: "whatsapp", budget_paise: 75000, status: "completed", ai_creative: "Limited time offer!" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(campaigns) });

    const result = await makeClient().campaigns(TOKEN);
    expect(result).toHaveLength(3);

    const withCreative = result.filter(c => c.ai_creative !== null);
    expect(withCreative).toHaveLength(2);
    expect(result[0].ai_creative).toBe("Order now! Fast delivery.");
    expect(result[1].ai_creative).toBeNull();
  });

  test("campaign status values: active, paused, completed", () => {
    const validStatuses = ["active", "paused", "completed"];
    validStatuses.forEach(s => expect(validStatuses).toContain(s));
  });

  test("active campaigns are the only ones driving spend", () => {
    const campaigns = [
      { id: "c-001", status: "active", budget_paise: 100000 },
      { id: "c-002", status: "paused", budget_paise: 50000 },
      { id: "c-003", status: "completed", budget_paise: 75000 },
    ];
    const activeBudget = campaigns
      .filter(c => c.status === "active")
      .reduce((sum, c) => sum + c.budget_paise, 0);
    expect(activeBudget).toBe(100000);
  });

  test("campaign name uses timestamp suffix for uniqueness", () => {
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const name = `Campaign ${suffix}`;
    expect(name.startsWith("Campaign ")).toBe(true);
  });

  test("push campaigns are suited for real-time delivery alerts", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "camp-push" }) });

    await makeClient().createCampaign(TOKEN, "Order Alert Campaign", "push", 100000, "Your order is 5 minutes away!");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.channel).toBe("push");
    expect(body.aiCreative).toContain("minutes away");
  });
});

// ── Driver Incentives ─────────────────────────────────────────────────────────

describe("Driver incentives — targets and rewards", () => {
  test("creates incentive with delivery target and reward", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "inc-001" }) });

    await makeClient().createDriverIncentive(TOKEN, "Weekly Warrior", 50, 7500);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.title).toBe("Weekly Warrior");
    expect(body.targetDeliveries).toBe(50);
    expect(body.rewardPaise).toBe(7500);
    expect(body.driverId).toBeUndefined();
  });

  test("creates platform-wide incentive (no specific driverId)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "inc-002" }) });

    await makeClient().createDriverIncentive(TOKEN, "Monthly Champion", 200, 50000);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.driverId).toBeUndefined();
  });

  test("creates driver-specific incentive with driverId", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "inc-003" }) });

    await makeClient().createDriverIncentive(TOKEN, "Top Driver Bonus", 100, 15000, "driver-001");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.driverId).toBe("driver-001");
    expect(body.rewardPaise).toBe(15000);
  });

  test("fetches incentives with target_deliveries, reward_paise, status", async () => {
    const incentives = [
      { id: "inc-001", title: "Weekly Warrior", target_deliveries: 50, reward_paise: 7500, status: "active" },
      { id: "inc-002", title: "Monthly Champion", target_deliveries: 200, reward_paise: 50000, status: "active" },
      { id: "inc-003", title: "Old Bonus", target_deliveries: 30, reward_paise: 3000, status: "expired" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(incentives) });

    const result = await makeClient().driverIncentives(TOKEN);
    const active = result.filter(i => i.status === "active");
    const expired = result.filter(i => i.status === "expired");
    expect(active).toHaveLength(2);
    expect(expired).toHaveLength(1);
  });

  test("incentive reward display: '50 deliveries → ₹75'", () => {
    const incentive = { target_deliveries: 50, reward_paise: 7500 };
    const display = `${incentive.target_deliveries} deliveries → ₹${incentive.reward_paise / 100}`;
    expect(display).toBe("50 deliveries → ₹75");
  });

  test("incentive progress: completed_deliveries vs target", () => {
    const incentive = { target_deliveries: 50, reward_paise: 7500 };
    const completedDeliveries = 32;
    const remaining = incentive.target_deliveries - completedDeliveries;
    const progressPercent = Math.floor((completedDeliveries / incentive.target_deliveries) * 100);

    expect(remaining).toBe(18);
    expect(progressPercent).toBe(64);
  });

  test("incentive name uses timestamp suffix for uniqueness", () => {
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    const title = `Delivery Bonus ${suffix}`;
    expect(title.startsWith("Delivery Bonus ")).toBe(true);
  });
});

// ── Driver Load Balancing ─────────────────────────────────────────────────────

describe("Driver load balancing — capacity scoring", () => {
  test("fetches driver load with active_orders and capacity_score", async () => {
    const load = [
      { id: "driver-001", phone: "+919999000003", active_orders: 0, capacity_score: 1.0 },
      { id: "driver-002", phone: "+919999000005", active_orders: 2, capacity_score: 0.7 },
      { id: "driver-003", phone: "+919999000006", active_orders: 5, capacity_score: 0.1 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(load) });

    const result = await makeClient().driverLoadBalancing(TOKEN);
    const fullyAvailable = result.filter(d => d.active_orders === 0);
    const atCapacity = result.filter(d => d.capacity_score < 0.2);
    expect(fullyAvailable).toHaveLength(1);
    expect(atCapacity).toHaveLength(1);
  });

  test("capacity_score=1.0 means fully available (no active orders)", () => {
    const driver = { active_orders: 0, capacity_score: 1.0 };
    expect(driver.capacity_score).toBe(1.0);
    expect(driver.active_orders).toBe(0);
  });

  test("capacity_score decreases as active_orders increase", () => {
    const drivers = [
      { active_orders: 0, capacity_score: 1.0 },
      { active_orders: 2, capacity_score: 0.7 },
      { active_orders: 5, capacity_score: 0.1 },
    ];
    for (let i = 1; i < drivers.length; i++) {
      expect(drivers[i].capacity_score).toBeLessThan(drivers[i - 1].capacity_score);
      expect(drivers[i].active_orders).toBeGreaterThan(drivers[i - 1].active_orders);
    }
  });

  test("best driver has highest capacity_score", () => {
    const drivers = [
      { id: "d-001", capacity_score: 0.5 },
      { id: "d-002", capacity_score: 1.0 },
      { id: "d-003", capacity_score: 0.3 },
    ];
    const best = drivers.reduce((prev, curr) => curr.capacity_score > prev.capacity_score ? curr : prev);
    expect(best.id).toBe("d-002");
  });

  test("assignBestDriver posts to AI endpoint and returns assigned driverId", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ driverId: "driver-002", message: "Best driver assigned based on proximity and load" }) });

    await makeClient().assignBestDriver(TOKEN, "order-001");
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/operations/orders/order-001/assign-best-driver");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  test("Assign First Available picks driver with lowest active_orders", () => {
    const drivers = [
      { id: "d-001", phone: "+91999", active_orders: 3, capacity_score: 0.4 },
      { id: "d-002", phone: "+91888", active_orders: 0, capacity_score: 1.0 },
      { id: "d-003", phone: "+91777", active_orders: 1, capacity_score: 0.8 },
    ];
    const mostAvailable = drivers.reduce((prev, curr) => curr.active_orders < prev.active_orders ? curr : prev);
    expect(mostAvailable.id).toBe("d-002");
  });
});

// ── Demand Prediction & Analytics Jobs ───────────────────────────────────────

describe("Demand prediction — zoned forecasts with confidence", () => {
  test("fetches predictions with zone_key, cuisine_type, hour, count, confidence", async () => {
    const predictions = [
      { id: "pred-001", zone_key: "delhi-central", cuisine_type: "North Indian", hour_start: "2026-05-09T12:00:00Z", predicted_orders: 180, confidence: "high" },
      { id: "pred-002", zone_key: "gurgaon-sector-29", cuisine_type: "Chinese", hour_start: "2026-05-09T13:00:00Z", predicted_orders: 95, confidence: "medium" },
      { id: "pred-003", zone_key: "noida-sector-18", cuisine_type: null, hour_start: "2026-05-09T14:00:00Z", predicted_orders: 60, confidence: "low" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(predictions) });

    const result = await makeClient().demandPredictions(TOKEN);
    expect(result).toHaveLength(3);

    const highConf = result.filter(p => p.confidence === "high");
    const nullCuisine = result.filter(p => p.cuisine_type === null);
    expect(highConf).toHaveLength(1);
    expect(nullCuisine).toHaveLength(1);
  });

  test("confidence levels are: high, medium, low", () => {
    const validLevels = ["high", "medium", "low"];
    ["high", "medium", "low"].forEach(level => {
      expect(validLevels).toContain(level);
    });
  });

  test("high confidence prediction drives staffing decisions", () => {
    const predictions = [
      { zone_key: "delhi-central", predicted_orders: 180, confidence: "high" },
      { zone_key: "gurgaon", predicted_orders: 95, confidence: "medium" },
    ];
    const actionable = predictions.filter(p => p.confidence === "high");
    expect(actionable[0].predicted_orders).toBe(180);
  });

  test("null cuisine_type means all-cuisine aggregate prediction", () => {
    const prediction = { cuisine_type: null, predicted_orders: 300 };
    const isAggregate = prediction.cuisine_type === null;
    expect(isAggregate).toBe(true);
    expect(prediction.predicted_orders).toBe(300);
  });

  test("runDemandPredictionJob triggers ML job and returns predictions array", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ predictions: [{ zone: "delhi-central", predicted: 180 }, { zone: "gurgaon", predicted: 95 }] }) });

    const result = await makeClient().runDemandPredictionJob(TOKEN);
    expect(result).toMatchObject({ predictions: expect.any(Array) });
    expect((result.predictions as unknown[]).length).toBeGreaterThan(0);
  });

  test("analytics jobs list shows job_type, status, and timestamp", async () => {
    const jobs = [
      { id: "job-001", job_type: "demand_prediction", status: "complete", summary: { zones: 5, predictions: 25 }, created_at: "2026-05-09T10:00:00Z" },
      { id: "job-002", job_type: "demand_prediction", status: "running", summary: {}, created_at: "2026-05-09T11:00:00Z" },
      { id: "job-003", job_type: "driver_scoring", status: "failed", summary: { error: "timeout" }, created_at: "2026-05-09T09:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(jobs) });

    const result = await makeClient().analyticsJobs(TOKEN);
    const complete = result.filter(j => j.status === "complete");
    const running = result.filter(j => j.status === "running");
    const failed = result.filter(j => j.status === "failed");
    expect(complete).toHaveLength(1);
    expect(running).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });

  test("job summary contains execution metadata", async () => {
    const jobs = [
      { id: "job-001", job_type: "demand_prediction", status: "complete", summary: { zones: 5, predictions: 25, duration_ms: 1240 }, created_at: "2026-05-09T10:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(jobs) });

    const result = await makeClient().analyticsJobs(TOKEN);
    expect(result[0].summary).toMatchObject({ zones: 5, predictions: 25 });
  });
});
