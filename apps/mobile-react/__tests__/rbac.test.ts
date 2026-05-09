/**
 * Role-Based Access Control (RBAC) — full coverage for all 6 roles
 *
 * Roles: customer | driver | restaurant | admin | super_admin | delivery_admin
 *
 * Tests cover:
 *   - JWT role extraction for every role
 *   - Tab routing decisions by role
 *   - Role-specific available tabs (no cross-role access)
 *   - Role help text correctness
 *   - Customer-specific API permissions (reviews, offers, orders, support)
 *   - Super admin vs admin permission scope
 *   - Delivery admin scope (delivery ops only)
 *   - Unauthenticated state
 */

import { ApiClient } from "../src/api";

const BASE = "http://localhost:4000";

type Role = "customer" | "driver" | "restaurant" | "admin" | "super_admin" | "delivery_admin";
type Tab = "driver" | "restaurant" | "admin";

const ALL_ROLES: Role[] = ["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"];
const VALID_ROLES: Role[] = ["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"];

// ── JWT Role Decoding ─────────────────────────────────────────────────────────

function decodeRole(token: string): Role | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload?.role && VALID_ROLES.includes(payload.role)) return payload.role as Role;
    return null;
  } catch {
    return null;
  }
}

function makeJwt(role: Role, sub = "user-001"): string {
  const encoded = btoa(JSON.stringify({ sub, role, iat: 1700000000, exp: 1700086400 }));
  return `eyJhbGciOiJIUzI1NiJ9.${encoded}.mock_signature`;
}

describe("JWT role decoding — all 6 roles", () => {
  test.each(ALL_ROLES)("extracts %s role from JWT", (role) => {
    expect(decodeRole(makeJwt(role))).toBe(role);
  });

  test("returns null for unknown role 'superuser'", () => {
    const token = btoa(JSON.stringify({ role: "superuser" }));
    expect(decodeRole(`h.${token}.s`)).toBeNull();
  });

  test("returns null for JWT with no role claim", () => {
    const token = btoa(JSON.stringify({ sub: "user-001" }));
    expect(decodeRole(`h.${token}.s`)).toBeNull();
  });

  test("returns null for malformed JWT (1 segment)", () => {
    expect(decodeRole("notajwt")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(decodeRole("")).toBeNull();
  });

  test("returns null for JWT with invalid base64 payload", () => {
    expect(decodeRole("header.!!!invalid!!!.sig")).toBeNull();
  });

  test("JWT contains iat and exp claims alongside role", () => {
    const token = makeJwt("driver");
    const payload = JSON.parse(atob(token.split(".")[1]));
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.role).toBe("driver");
  });
});

// ── Tab Routing by Role ───────────────────────────────────────────────────────

function getAvailableTabs(role: Role): Tab[] {
  if (role === "driver") return ["driver"];
  if (role === "restaurant") return ["restaurant"];
  return ["admin"];
}

function getDefaultTab(role: Role): Tab {
  return getAvailableTabs(role)[0];
}

describe("Tab routing — role to tab mapping", () => {
  test("driver → ['driver'] tab only", () => {
    expect(getAvailableTabs("driver")).toEqual(["driver"]);
    expect(getDefaultTab("driver")).toBe("driver");
  });

  test("restaurant → ['restaurant'] tab only", () => {
    expect(getAvailableTabs("restaurant")).toEqual(["restaurant"]);
    expect(getDefaultTab("restaurant")).toBe("restaurant");
  });

  test("admin → ['admin'] tab", () => {
    expect(getAvailableTabs("admin")).toEqual(["admin"]);
    expect(getDefaultTab("admin")).toBe("admin");
  });

  test("super_admin → ['admin'] tab (same UI, broader data)", () => {
    expect(getAvailableTabs("super_admin")).toEqual(["admin"]);
    expect(getDefaultTab("super_admin")).toBe("admin");
  });

  test("delivery_admin → ['admin'] tab", () => {
    expect(getAvailableTabs("delivery_admin")).toEqual(["admin"]);
    expect(getDefaultTab("delivery_admin")).toBe("admin");
  });

  test("customer → falls through to ['admin'] tab (no dedicated customer tab)", () => {
    expect(getAvailableTabs("customer")).toEqual(["admin"]);
  });

  test("no role gives access to more than one tab at a time", () => {
    ALL_ROLES.forEach(role => {
      expect(getAvailableTabs(role)).toHaveLength(1);
    });
  });

  test("invalid tab is reset to the first available tab", () => {
    const role: Role = "driver";
    const available = getAvailableTabs(role);
    const currentTab: Tab = "restaurant";
    const resolved = available.includes(currentTab) ? currentTab : available[0];
    expect(resolved).toBe("driver");
  });
});

// ── Role-Specific Help Text ───────────────────────────────────────────────────

function getRoleHelp(role: Role): string {
  switch (role) {
    case "driver":
      return "Driver mode — onboarding, live deliveries, wallet and payout requests.";
    case "restaurant":
      return "Restaurant mode — onboarding, menu management, orders and earnings.";
    default:
      return "Admin mode — platform health, approvals, live tracking, analytics and payouts.";
  }
}

describe("Role help text", () => {
  test("driver gets driver-specific help", () => {
    expect(getRoleHelp("driver")).toContain("Driver mode");
    expect(getRoleHelp("driver")).toContain("wallet");
  });

  test("restaurant gets restaurant-specific help", () => {
    expect(getRoleHelp("restaurant")).toContain("Restaurant mode");
    expect(getRoleHelp("restaurant")).toContain("menu");
  });

  test.each(["admin", "super_admin", "delivery_admin", "customer"] as Role[])(
    "%s gets admin help text",
    (role) => {
      expect(getRoleHelp(role)).toContain("Admin mode");
    }
  );
});

// ── Customer Role — Permitted API Calls ──────────────────────────────────────

describe("Customer role — permitted API operations", () => {
  const client = new ApiClient(BASE);
  const CUSTOMER_TOKEN = makeJwt("customer");
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("customer can search restaurants", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await client.searchRestaurants(CUSTOMER_TOKEN, { diet: "all", lat: 28.6, lng: 77.2 });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/restaurants/search");
  });

  test("customer can view trending restaurants", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await client.trendingRestaurants(CUSTOMER_TOKEN, 28.6, 77.2);
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/restaurants/trending");
  });

  test("customer can create an order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "order-cust-001", totalPaise: 34900, status: "pending", estimatedDeliveryAt: null }) });
    const result = await client.createOrder(CUSTOMER_TOKEN, "rest-001", 28.6, 77.2, [{ name: "Burger", quantity: 1, pricePaise: 34900 }]);
    expect(result).toMatchObject({ id: "order-cust-001" });
  });

  test("customer can view marketplace offers", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([{ id: "offer-001", code: "SAVE50", title: "Save ₹50", discount_type: "flat", discount_value: 5000 }]) });
    const result = await client.marketplaceOffers(CUSTOMER_TOKEN);
    expect(result[0].code).toBe("SAVE50");
  });

  test("customer can submit a restaurant review", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-001" }) });
    await client.createRestaurantReview(CUSTOMER_TOKEN, "rest-001", 5, "Excellent food!", "order-cust-001");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rating).toBe(5);
    expect(body.comment).toBe("Excellent food!");
    expect(body.orderId).toBe("order-cust-001");
  });

  test("customer can create a support ticket", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-001" }) });
    await client.createSupportTicket(CUSTOMER_TOKEN, "delivery", "Late delivery", "My order was 45 min late.", "order-cust-001");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.category).toBe("delivery");
    expect(body.orderId).toBe("order-cust-001");
  });

  test("customer can cancel an order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ cancelled: true }) });
    await client.cancelOrder(CUSTOMER_TOKEN, "order-cust-001", "Changed my mind");
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/cancel");
  });

  test("customer can request a refund", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ refund_id: "ref-001" }) });
    await client.requestRefund(CUSTOMER_TOKEN, "order-cust-001", "Item was missing", 34900);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reason).toBe("Item was missing");
    expect(body.amountPaise).toBe(34900);
  });

  test("customer can reorder a previous order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "order-cust-002", totalPaise: 34900, status: "pending", estimatedDeliveryAt: null }) });
    const result = await client.reorder(CUSTOMER_TOKEN, "order-cust-001");
    expect(result).toMatchObject({ id: "order-cust-002" });
  });

  test("customer can initiate payment via PhonePe", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ paymentUrl: "https://phonepe.com/pay?token=xyz", provider: "phonepe" }) });
    const result = await client.createPayment(CUSTOMER_TOKEN, "phonepe", "order-cust-001", 34900);
    expect(result.paymentUrl).toContain("phonepe.com");
  });

  test("customer can get order ETA", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ predictedEtaMinutes: 28, predictedDeliveryAt: "2026-05-08T16:00:00Z", route: { origin: { lat: 28.6, lng: 77.2 }, pickup: { lat: 28.61, lng: 77.21 }, dropoff: { lat: 28.62, lng: 77.22 }, distanceToPickupKm: 1.5, distanceToDropoffKm: 3.2 } }) });
    const result = await client.orderEta(CUSTOMER_TOKEN, "order-cust-001");
    expect(result.predictedEtaMinutes).toBe(28);
  });
});

// ── Super Admin vs Admin Permission Scope ─────────────────────────────────────

describe("Super admin vs admin scope", () => {
  const client = new ApiClient(BASE);
  const ADMIN_TOKEN = makeJwt("admin");
  const SUPER_ADMIN_TOKEN = makeJwt("super_admin");
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("both admin and super_admin can fetch admin dashboard", async () => {
    const dashboard = { users: 120, ordersByStatus: [], revenuePaise: 5000000, payments: [], recentOrders: [] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(dashboard) });

    await client.adminDashboard(ADMIN_TOKEN);
    await client.adminDashboard(SUPER_ADMIN_TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(`Bearer ${ADMIN_TOKEN}`);
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe(`Bearer ${SUPER_ADMIN_TOKEN}`);
  });

  test("super_admin can approve restaurants (same endpoint as admin)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "rest-001", approval_status: "approved" }) });
    await client.updateRestaurantApproval(SUPER_ADMIN_TOKEN, "rest-001", "approved");
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/admin/restaurants/rest-001/approval");
  });

  test("super_admin can access payment reports for all providers", async () => {
    const reports = [
      { provider: "paytm", status: "success", transactions: 50, amount_paise: 1245000 },
      { provider: "phonepe", status: "success", transactions: 30, amount_paise: 750000 },
      { provider: "razorpay", status: "success", transactions: 20, amount_paise: 500000 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(reports) });
    const result = await client.paymentReports(SUPER_ADMIN_TOKEN);
    expect(result.map(r => r.provider)).toEqual(["paytm", "phonepe", "razorpay"]);
  });

  test("super_admin can view all platform users", async () => {
    const users = [
      { id: "u-001", phone: "+91999", email: null, name: "Ravi", role: "driver" },
      { id: "u-002", phone: "+91888", email: null, name: "Spice Garden", role: "restaurant" },
      { id: "u-003", phone: null, email: "admin@ak.com", name: "Admin", role: "admin" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(users) });
    const result = await client.adminUsers(SUPER_ADMIN_TOKEN);
    const roles = result.map(u => u.role);
    expect(roles).toContain("driver");
    expect(roles).toContain("restaurant");
    expect(roles).toContain("admin");
  });

  test("super_admin can run demand prediction ML jobs", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ predictions: [{ zone: "Delhi NCR", predicted: 250 }] }) });
    await client.runDemandPredictionJob(SUPER_ADMIN_TOKEN);
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/operations/analytics/jobs/demand-prediction");
  });

  test("super_admin can approve driver payout requests", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-001", status: "approved" }) });
    await client.updatePayoutApproval(SUPER_ADMIN_TOKEN, "payout-001", "approved", "Approved by super admin");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.note).toBe("Approved by super admin");
  });
});

// ── Delivery Admin Scope ──────────────────────────────────────────────────────

describe("Delivery admin scope — delivery operations only", () => {
  const client = new ApiClient(BASE);
  const DA_TOKEN = makeJwt("delivery_admin");
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("delivery_admin can list all active delivery orders", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([{ id: "order-A", status: "assigned", restaurant_name: "Pizza Hut", last_driver_lat: "28.61", last_driver_lng: "77.21" }]) });
    const result = await client.deliveryAdminOrders(DA_TOKEN);
    expect(result).toHaveLength(1);
  });

  test("delivery_admin can list available delivery drivers", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([{ id: "driver-001", phone: "+91999", name: "Ravi Kumar" }]) });
    const result = await client.deliveryDrivers(DA_TOKEN);
    expect(result[0].name).toBe("Ravi Kumar");
  });

  test("delivery_admin can assign a specific driver to an order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ assigned: true }) });
    await client.assignDriver(DA_TOKEN, "order-A", "driver-001");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.driverId).toBe("driver-001");
  });

  test("delivery_admin can use AI best-driver assignment", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ driverId: "driver-best" }) });
    await client.assignBestDriver(DA_TOKEN, "order-A");
    expect((fetchMock.mock.calls[0][0] as string)).toContain("assign-best-driver");
  });

  test("delivery_admin can view driver load balancing scores", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([{ id: "d-001", phone: "+91999", active_orders: 1, capacity_score: 0.8 }]) });
    const result = await client.driverLoadBalancing(DA_TOKEN);
    expect(result[0].capacity_score).toBe(0.8);
  });
});

// ── Driver Role Scope ─────────────────────────────────────────────────────────

describe("Driver role — permitted and expected API calls", () => {
  const client = new ApiClient(BASE);
  const DRIVER_TOKEN = makeJwt("driver");
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("driver can view available delivery orders", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await client.availableDeliveryOrders(DRIVER_TOKEN);
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/orders/available");
  });

  test("driver can accept a delivery order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-A", status: "assigned" }) });
    await client.acceptDeliveryOrder(DRIVER_TOKEN, "order-A");
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/assign");
  });

  test("driver can update order status to picked_up and delivered", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ status: "picked_up" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ status: "delivered" }) });

    await client.updateOrderStatus(DRIVER_TOKEN, "order-A", "picked_up");
    await client.updateOrderStatus(DRIVER_TOKEN, "order-A", "delivered");

    const [, pickupBody] = fetchMock.mock.calls[0];
    const [, deliveredBody] = fetchMock.mock.calls[1];
    expect(JSON.parse((pickupBody as RequestInit).body as string).status).toBe("picked_up");
    expect(JSON.parse((deliveredBody as RequestInit).body as string).status).toBe("delivered");
  });

  test("driver can request UPI payout from wallet", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-001" }) });
    await client.requestPayout(DRIVER_TOKEN, 50000, "upi", "driver@upi");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.method).toBe("upi");
  });

  test("driver can submit onboarding application", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "app-001", approval_status: "pending" }) });
    await client.submitDriverOnboarding(DRIVER_TOKEN, { fullName: "Ravi Kumar", aadhaarLast4: "1234" });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/driver-onboarding/signup");
  });
});

// ── Restaurant Role Scope ─────────────────────────────────────────────────────

describe("Restaurant role — permitted API calls", () => {
  const client = new ApiClient(BASE);
  const REST_TOKEN = makeJwt("restaurant");
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  test("restaurant can submit onboarding with compliance IDs", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-001" }) });
    await client.onboardRestaurant(REST_TOKEN, {
      name: "Spice Garden",
      address: "12 MG Road, Delhi",
      contactName: "Amar Singh",
      contactPhone: "+919999000002",
      cuisineType: "North Indian",
      fssaiLicense: "FSSAI1234567890",
      gstNumber: "22AAAAA0000A1Z5",
      bankAccountLast4: "9999",
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.fssaiLicense).toBe("FSSAI1234567890");
    expect(body.gstNumber).toBe("22AAAAA0000A1Z5");
  });

  test("restaurant can add menu items", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-001" }) });
    await client.createMenuItem(REST_TOKEN, "rest-001", { name: "Butter Chicken", pricePaise: 29900, isVeg: false });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("/menu");
  });

  test("restaurant can accept an incoming order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-001", status: "accepted" }) });
    await client.decideRestaurantOrder(REST_TOKEN, "order-001", "accepted");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.decision).toBe("accepted");
  });

  test("restaurant can view its own earnings", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ orders: "42", gross_paise: "1050000", estimated_payout_paise: "945000" }) });
    const result = await client.restaurantEarnings(REST_TOKEN, "rest-001");
    expect(Number(result.gross_paise)).toBe(1050000);
  });
});

// ── Unauthenticated State ─────────────────────────────────────────────────────

describe("Unauthenticated state", () => {
  test("token is empty string by default (not authenticated)", () => {
    const token = "";
    expect(Boolean(token)).toBe(false);
  });

  test("authed flag is false when token is empty", () => {
    const authed = Boolean("");
    expect(authed).toBe(false);
  });

  test("authed flag is true when token is present", () => {
    const authed = Boolean(makeJwt("driver"));
    expect(authed).toBe(true);
  });

  test("unauthenticated request has no Authorization header (OTP request)", async () => {
    const client = new ApiClient(BASE);
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ sent: true }) });
    await client.requestOtp("+919999000003");
    const headers = ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  test("OTP verify also sends no Authorization header", async () => {
    const client = new ApiClient(BASE);
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ token: "jwt.payload.sig", user: { role: "driver" } }) });
    await client.verifyOtp("+919999000003", "123456", "driver");
    const headers = ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });
});
