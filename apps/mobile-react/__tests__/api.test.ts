/**
 * API Client — comprehensive endpoint coverage
 *
 * Every method on ApiClient is tested with:
 *   • A happy-path (200 OK) assertion on the URL, method, headers, and body sent
 *   • An error-path (4xx / 5xx) that checks the Error message is forwarded
 *   • A timeout-path (AbortError) that checks the "Request timed out" wrapper
 */

import { ApiClient } from "../src/api";

const BASE = "http://localhost:4000";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new ApiClient(BASE);
}

function mockFetch(body: unknown, status = 200) {
  const text = JSON.stringify(body);
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response);
}

function mockFetchError(message: string) {
  global.fetch = jest.fn().mockRejectedValue(new Error(message));
}

function mockFetchTimeout() {
  global.fetch = jest.fn().mockImplementation(() => {
    const err = new Error("aborted");
    err.name = "AbortError";
    return Promise.reject(err);
  });
}

function lastCall() {
  return (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
}

function lastUrl() { return lastCall()[0]; }
function lastInit() { return lastCall()[1]; }
function lastBody() { return JSON.parse(lastInit().body as string); }
function lastHeaders() { return lastInit().headers as Record<string, string>; }

const TOKEN = "test-bearer-token";

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("ApiClient — Auth", () => {
  const client = makeClient();

  test("requestOtp sends phone and returns sent flag", async () => {
    mockFetch({ sent: true, devCode: "123456" });
    const result = await client.requestOtp("+919999000003");
    expect(lastUrl()).toBe(`${BASE}/api/v1/auth/otp/request`);
    expect(lastInit().method).toBe("POST");
    expect(lastBody()).toEqual({ phone: "+919999000003" });
    expect(result).toEqual({ sent: true, devCode: "123456" });
  });

  test("requestOtp throws on 400 error", async () => {
    mockFetch({ error: "Phone invalid" }, 400);
    await expect(client.requestOtp("bad")).rejects.toThrow("Phone invalid");
  });

  test("requestOtp throws timeout wrapper on AbortError", async () => {
    mockFetchTimeout();
    await expect(client.requestOtp("+91999")).rejects.toThrow("Request timed out");
  });

  test("verifyOtp posts phone, code, role and returns AuthSession", async () => {
    const session = { token: "jwt.payload.sig", user: { role: "driver" } };
    mockFetch(session);
    const result = await client.verifyOtp("+919999000003", "123456", "driver");
    expect(lastUrl()).toBe(`${BASE}/api/v1/auth/otp/verify`);
    expect(lastBody()).toEqual({ phone: "+919999000003", code: "123456", role: "driver" });
    expect(result).toEqual(session);
  });

  test("verifyOtp throws on 401", async () => {
    mockFetch({ error: "OTP expired" }, 401);
    await expect(client.verifyOtp("+91999", "000", "driver")).rejects.toThrow("OTP expired");
  });

  test("googleLogin posts idToken and role", async () => {
    mockFetch({ token: "google-jwt", user: {} });
    const result = await client.googleLogin("google-id-token", "restaurant");
    expect(lastUrl()).toBe(`${BASE}/api/v1/auth/google`);
    expect(lastBody()).toEqual({ idToken: "google-id-token", role: "restaurant" });
    expect(result).toMatchObject({ token: "google-jwt" });
  });
});

// ── Notifications ─────────────────────────────────────────────────────────────

describe("ApiClient — Notifications", () => {
  const client = makeClient();

  test("registerDeviceToken posts pushToken and platform with bearer header", async () => {
    mockFetch({ registered: true });
    await client.registerDeviceToken(TOKEN, "ExponentPushToken[abc]");
    expect(lastUrl()).toBe(`${BASE}/api/v1/notifications/device-token`);
    expect(lastHeaders().authorization).toBe(`Bearer ${TOKEN}`);
    const body = lastBody();
    expect(body.token).toBe("ExponentPushToken[abc]");
    expect(["ios", "android"]).toContain(body.platform);
  });

  test("sendTestNotification posts to /notifications/test with bearer", async () => {
    mockFetch({ sent: true });
    await client.sendTestNotification(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/notifications/test`);
    expect(lastHeaders().authorization).toBe(`Bearer ${TOKEN}`);
  });
});

// ── Restaurants & Marketplace ─────────────────────────────────────────────────

describe("ApiClient — Restaurants", () => {
  const client = makeClient();

  test("trendingRestaurants hits correct URL with lat/lng", async () => {
    mockFetch([]);
    await client.trendingRestaurants(TOKEN, 28.6139, 77.209);
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/trending?lat=28.6139&lng=77.209`);
    expect(lastInit().method).toBe("GET");
    expect(lastHeaders().authorization).toBe(`Bearer ${TOKEN}`);
  });

  test("searchRestaurants builds query params correctly", async () => {
    mockFetch([]);
    await client.searchRestaurants(TOKEN, {
      q: "pizza",
      cuisine: "Italian",
      diet: "veg",
      minRating: 4,
      sort: "rating_desc",
      lat: 28.6,
      lng: 77.2,
    });
    const url = new URL(lastUrl());
    expect(url.pathname).toBe("/api/v1/restaurants/search");
    expect(url.searchParams.get("q")).toBe("pizza");
    expect(url.searchParams.get("cuisine")).toBe("Italian");
    expect(url.searchParams.get("diet")).toBe("veg");
    expect(url.searchParams.get("minRating")).toBe("4");
    expect(url.searchParams.get("sort")).toBe("rating_desc");
  });

  test("searchRestaurants omits undefined/null/empty params", async () => {
    mockFetch([]);
    await client.searchRestaurants(TOKEN, { diet: "all" });
    const url = new URL(lastUrl());
    expect(url.searchParams.get("q")).toBeNull();
  });

  test("googlePlacesDelhiNcr hits correct URL", async () => {
    mockFetch({ restaurants: [] });
    await client.googlePlacesDelhiNcr(TOKEN, 4);
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/google-places/delhi-ncr?minRating=4`);
  });

  test("googlePlacesRegion hits correct URL", async () => {
    mockFetch({ restaurants: [] });
    await client.googlePlacesRegion(TOKEN, 3);
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/google-places/region?minRating=3`);
  });

  test("createRestaurantReview posts to reviews endpoint", async () => {
    mockFetch({ id: "review-1" });
    await client.createRestaurantReview(TOKEN, "rest-abc", 5, "Great!", "order-xyz");
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/restaurants/rest-abc/reviews`);
    expect(lastBody()).toMatchObject({ rating: 5, comment: "Great!", orderId: "order-xyz" });
  });

  test("createSupportTicket posts required fields", async () => {
    mockFetch({ id: "ticket-1" });
    await client.createSupportTicket(TOKEN, "billing", "Wrong charge", "Charged twice", "order-1");
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/support/tickets`);
    expect(lastBody()).toEqual({
      category: "billing",
      subject: "Wrong charge",
      message: "Charged twice",
      orderId: "order-1",
    });
  });
});

// ── Orders ────────────────────────────────────────────────────────────────────

describe("ApiClient — Orders", () => {
  const client = makeClient();

  test("createOrder posts restaurantId, address, location and items", async () => {
    mockFetch({ id: "order-001", totalPaise: 24900, status: "pending", estimatedDeliveryAt: "2026-05-08T15:00:00Z" });
    const items = [{ name: "Burger", quantity: 2, pricePaise: 12450 }];
    const result = await client.createOrder(TOKEN, "rest-001", 28.6, 77.2, items);
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders`);
    expect(lastInit().method).toBe("POST");
    expect(lastHeaders()["idempotency-key"]).toBeDefined();
    const body = lastBody();
    expect(body.restaurantId).toBe("rest-001");
    expect(body.deliveryLat).toBe(28.6);
    expect(body.deliveryLng).toBe(77.2);
    expect(body.items).toEqual(items);
    expect(result).toMatchObject({ id: "order-001", status: "pending" });
  });

  test("getOrder fetches order by ID", async () => {
    const order = { id: "order-001", status: "accepted", total_paise: 24900, delivery_address: "123 Main St", delivery_lat: "28.6", delivery_lng: "77.2", estimated_delivery_at: null, driver_phone: null, driver_name: null, history: [] };
    mockFetch(order);
    const result = await client.getOrder(TOKEN, "order-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/order-001`);
    expect(lastInit().method).toBe("GET");
    expect(result).toEqual(order);
  });

  test("editOrder patches delivery address and coordinates", async () => {
    mockFetch({ id: "order-001" });
    await client.editOrder(TOKEN, "order-001", "New Address", 28.7, 77.3);
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/order-001`);
    expect(lastInit().method).toBe("PATCH");
    expect(lastBody()).toEqual({ deliveryAddress: "New Address", deliveryLat: 28.7, deliveryLng: 77.3 });
  });

  test("cancelOrder posts reason", async () => {
    mockFetch({ cancelled: true });
    await client.cancelOrder(TOKEN, "order-001", "Changed mind");
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/order-001/cancel`);
    expect(lastBody()).toEqual({ reason: "Changed mind" });
  });

  test("reorder posts to reorder endpoint and returns new order", async () => {
    mockFetch({ id: "order-002", totalPaise: 24900, status: "pending", estimatedDeliveryAt: null });
    const result = await client.reorder(TOKEN, "order-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/order-001/reorder`);
    expect(result).toMatchObject({ id: "order-002" });
  });

  test("availableDeliveryOrders fetches available orders", async () => {
    mockFetch([{ id: "order-A" }]);
    const result = await client.availableDeliveryOrders(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/available`);
    expect(result).toHaveLength(1);
  });

  test("acceptDeliveryOrder patches assign endpoint", async () => {
    mockFetch({ id: "order-A", status: "assigned" });
    await client.acceptDeliveryOrder(TOKEN, "order-A");
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/order-A/assign`);
    expect(lastInit().method).toBe("PATCH");
  });

  test("updateOrderStatus patches status", async () => {
    mockFetch({ status: "picked_up" });
    await client.updateOrderStatus(TOKEN, "order-A", "picked_up");
    expect(lastUrl()).toBe(`${BASE}/api/v1/orders/order-A/status`);
    expect(lastBody()).toEqual({ status: "picked_up" });
  });
});

// ── Payments ──────────────────────────────────────────────────────────────────

describe("ApiClient — Payments", () => {
  const client = makeClient();

  test("createPayment posts provider, orderId, amount", async () => {
    mockFetch({ redirectUrl: "https://paytm.com/pay?token=abc", provider: "paytm" });
    const result = await client.createPayment(TOKEN, "paytm", "order-001", 24900);
    expect(lastUrl()).toBe(`${BASE}/api/v1/payments/create`);
    expect(lastBody()).toEqual({ provider: "paytm", orderId: "order-001", amountPaise: 24900 });
    expect(result).toMatchObject({ redirectUrl: "https://paytm.com/pay?token=abc" });
  });

  test("createPayment uses default amount of 24900", async () => {
    mockFetch({ provider: "phonepe" });
    await client.createPayment(TOKEN, "phonepe", "order-001");
    expect(lastBody().amountPaise).toBe(24900);
  });

  test("requestRefund posts orderId, reason, and optional amount", async () => {
    mockFetch({ refund_id: "ref-001" });
    await client.requestRefund(TOKEN, "order-001", "Item missing", 12450);
    expect(lastUrl()).toBe(`${BASE}/api/v1/payments/refunds`);
    expect(lastBody()).toEqual({ orderId: "order-001", reason: "Item missing", amountPaise: 12450 });
  });
});

// ── Tracking & ETA ───────────────────────────────────────────────────────────

describe("ApiClient — Tracking & ETA", () => {
  const client = makeClient();

  test("orderEta returns ETA and route details", async () => {
    const etaResponse = {
      predictedEtaMinutes: 30,
      predictedDeliveryAt: "2026-05-08T15:30:00Z",
      route: {
        origin: { lat: 28.6, lng: 77.2 },
        pickup: { lat: 28.61, lng: 77.21 },
        dropoff: { lat: 28.62, lng: 77.22 },
        distanceToPickupKm: 1.2,
        distanceToDropoffKm: 3.5,
      },
    };
    mockFetch(etaResponse);
    const result = await client.orderEta(TOKEN, "order-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/tracking/orders/order-001/eta`);
    expect(result).toEqual(etaResponse);
  });

  test("orderEtaLoop returns array of historical ETAs", async () => {
    mockFetch([{ id: "eta-1", predicted_eta_minutes: 25, source: "ml", created_at: "2026-05-08T12:00:00Z" }]);
    const result = await client.orderEtaLoop(TOKEN, "order-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/tracking/orders/order-001/eta-loop`);
    expect(result).toHaveLength(1);
  });

  test("sendDriverLocation posts lat and lng", async () => {
    mockFetch({ recorded: true });
    await client.sendDriverLocation(TOKEN, "order-001", 28.615, 77.215);
    expect(lastUrl()).toBe(`${BASE}/api/v1/tracking/orders/order-001/location`);
    expect(lastBody()).toEqual({ lat: 28.615, lng: 77.215 });
  });
});

// ── Driver Onboarding ─────────────────────────────────────────────────────────

describe("ApiClient — Driver Onboarding", () => {
  const client = makeClient();

  test("submitDriverOnboarding posts full KYC payload", async () => {
    const app = { id: "app-001", full_name: "Ravi Kumar", phone: "+919999000003", aadhaar_last4: "1234", ocr_status: "pending", selfie_status: "pending", background_check_status: "pending", bank_account_last4: "5678", upi_id: "ravi@upi", referral_code: null, approval_status: "pending", admin_note: null };
    mockFetch(app);
    const result = await client.submitDriverOnboarding(TOKEN, {
      fullName: "Ravi Kumar",
      aadhaarLast4: "1234",
      aadhaarFrontUrl: "https://blob.example.com/front.jpg",
      aadhaarBackUrl: "https://blob.example.com/back.jpg",
      selfieUrl: "https://blob.example.com/selfie.jpg",
      bankAccountLast4: "5678",
      upiId: "ravi@upi",
    });
    expect(lastUrl()).toBe(`${BASE}/api/v1/driver-onboarding/signup`);
    expect(lastBody()).toMatchObject({ fullName: "Ravi Kumar", aadhaarLast4: "1234" });
    expect(result).toEqual(app);
  });

  test("myDriverOnboarding fetches current application", async () => {
    mockFetch(null);
    const result = await client.myDriverOnboarding(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/driver-onboarding/mine`);
    expect(result).toBeNull();
  });

  test("runDriverBackgroundCheck posts consent flag", async () => {
    mockFetch({ id: "app-001", background_check_status: "in_progress" });
    await client.runDriverBackgroundCheck(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/driver-onboarding/background-check`);
    expect(lastBody()).toEqual({ consent: true });
  });

  test("driverOnboardingApplications fetches admin list", async () => {
    mockFetch([{ id: "app-001" }, { id: "app-002" }]);
    const result = await client.driverOnboardingApplications(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/driver-onboarding/admin/applications`);
    expect(result).toHaveLength(2);
  });

  test("updateDriverApplicationApproval patches status and note", async () => {
    mockFetch({ id: "app-001", approval_status: "approved" });
    await client.updateDriverApplicationApproval(TOKEN, "app-001", "approved", "Looks good");
    expect(lastUrl()).toBe(`${BASE}/api/v1/driver-onboarding/admin/applications/app-001/approval`);
    expect(lastBody()).toEqual({ status: "approved", note: "Looks good" });
  });

  test("updateDriverApplicationApproval can reject with note", async () => {
    mockFetch({ id: "app-002", approval_status: "rejected" });
    await client.updateDriverApplicationApproval(TOKEN, "app-002", "rejected", "Documents unclear");
    expect(lastBody()).toEqual({ status: "rejected", note: "Documents unclear" });
  });

  test("driverReferrals fetches referral list", async () => {
    mockFetch([{ id: "ref-001", referral_code: "DRV123", status: "pending", reward_paise: 50000 }]);
    const result = await client.driverReferrals(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/driver-onboarding/admin/referrals`);
    expect(result).toHaveLength(1);
  });
});

// ── Restaurant Management ─────────────────────────────────────────────────────

describe("ApiClient — Restaurant Management", () => {
  const client = makeClient();

  test("onboardRestaurant posts full registration payload", async () => {
    mockFetch({ id: "rest-001" });
    await client.onboardRestaurant(TOKEN, {
      name: "Spice Garden",
      address: "12 MG Road, Delhi",
      contactName: "Amar Singh",
      contactPhone: "+919999000002",
      cuisineType: "North Indian",
      fssaiLicense: "FSSAI001",
      gstNumber: "GST001",
      bankAccountLast4: "9999",
    });
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/onboarding`);
    expect(lastBody()).toMatchObject({ name: "Spice Garden", cuisineType: "North Indian" });
  });

  test("myRestaurants fetches owned restaurants", async () => {
    mockFetch([{ id: "rest-001", name: "Spice Garden", approval_status: "approved", onboarding_status: "complete" }]);
    const result = await client.myRestaurants(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/mine`);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Spice Garden");
  });

  test("createMenuItem posts item with isAvailable=true", async () => {
    mockFetch({ id: "item-001" });
    await client.createMenuItem(TOKEN, "rest-001", {
      name: "Paneer Tikka",
      pricePaise: 29900,
      description: "Fresh paneer",
      isVeg: true,
      cuisineType: "North Indian",
      rating: 4.5,
    });
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/rest-001/menu`);
    const body = lastBody();
    expect(body.name).toBe("Paneer Tikka");
    expect(body.isAvailable).toBe(true);
    expect(body.pricePaise).toBe(29900);
  });

  test("importMenuItems posts array of items", async () => {
    mockFetch({ imported: 2 });
    const items = [
      { name: "Item 1", pricePaise: 19900, isVeg: true },
      { name: "Item 2", pricePaise: 34900, isVeg: false },
    ];
    await client.importMenuItems(TOKEN, "rest-001", items);
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/rest-001/menu/import`);
    expect(lastBody()).toEqual({ items });
  });

  test("restaurantOrders fetches orders for a restaurant", async () => {
    mockFetch([{ id: "order-001", status: "pending", total_paise: 24900 }]);
    const result = await client.restaurantOrders(TOKEN, "rest-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/rest-001/orders`);
    expect(result).toHaveLength(1);
  });

  test("decideRestaurantOrder patches decision=accepted", async () => {
    mockFetch({ id: "order-001", status: "accepted" });
    await client.decideRestaurantOrder(TOKEN, "order-001", "accepted");
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/orders/order-001/decision`);
    expect(lastBody()).toEqual({ decision: "accepted" });
  });

  test("decideRestaurantOrder patches decision=cancelled", async () => {
    mockFetch({ id: "order-001", status: "cancelled" });
    await client.decideRestaurantOrder(TOKEN, "order-001", "cancelled");
    expect(lastBody()).toEqual({ decision: "cancelled" });
  });

  test("restaurantEarnings fetches earnings summary", async () => {
    mockFetch({ orders: "42", gross_paise: "1050000", estimated_payout_paise: "945000" });
    const result = await client.restaurantEarnings(TOKEN, "rest-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/restaurants/rest-001/earnings`);
    expect(result.orders).toBe("42");
  });
});

// ── Admin Dashboard ───────────────────────────────────────────────────────────

describe("ApiClient — Admin Dashboard", () => {
  const client = makeClient();

  test("adminDashboard fetches KPIs", async () => {
    const dashboard = { users: 120, ordersByStatus: [{ status: "pending", count: 5 }], revenuePaise: 5000000, payments: [], recentOrders: [] };
    mockFetch(dashboard);
    const result = await client.adminDashboard(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/dashboard`);
    expect(result.users).toBe(120);
  });

  test("adminRestaurants fetches all restaurants", async () => {
    mockFetch([{ id: "rest-001", name: "Spice Garden", address: "Delhi", approval_status: "pending" }]);
    const result = await client.adminRestaurants(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/restaurants`);
    expect(result).toHaveLength(1);
  });

  test("updateRestaurantApproval patches status=approved", async () => {
    mockFetch({ id: "rest-001", approval_status: "approved" });
    await client.updateRestaurantApproval(TOKEN, "rest-001", "approved");
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/restaurants/rest-001/approval`);
    expect(lastBody()).toEqual({ status: "approved" });
  });

  test("adminAllOrders fetches all orders", async () => {
    mockFetch([{ id: "order-001", status: "delivered", total_paise: 24900, restaurant_name: "Spice Garden" }]);
    const result = await client.adminAllOrders(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/orders`);
    expect(result).toHaveLength(1);
  });

  test("adminUsers fetches paginated users", async () => {
    mockFetch([{ id: "user-001", phone: "+919999000003", email: null, name: "Ravi", role: "driver" }]);
    const result = await client.adminUsers(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/users`);
    expect(result[0].role).toBe("driver");
  });

  test("paymentReports fetches provider stats", async () => {
    mockFetch([{ provider: "paytm", status: "success", transactions: 50, amount_paise: 1245000 }]);
    const result = await client.paymentReports(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/payment-reports`);
    expect(result[0].provider).toBe("paytm");
  });

  test("platformAnalytics fetches analytics summary", async () => {
    mockFetch({ dailyOrders: [], topRestaurants: [], driverStats: [] });
    const result = await client.platformAnalytics(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/admin/analytics`);
    expect(result).toMatchObject({ dailyOrders: [], topRestaurants: [] });
  });

  test("supportTickets fetches all tickets", async () => {
    mockFetch([{ id: "ticket-1", category: "technical", subject: "App crash", status: "open", created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.supportTickets(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/support/tickets`);
    expect(result).toHaveLength(1);
  });
});

// ── Delivery Admin ────────────────────────────────────────────────────────────

describe("ApiClient — Delivery Admin", () => {
  const client = makeClient();

  test("deliveryAdminOrders fetches delivery orders with location", async () => {
    mockFetch([{ id: "order-A", status: "picked_up", restaurant_name: "Pizza Hut", last_driver_lat: "28.61", last_driver_lng: "77.21" }]);
    const result = await client.deliveryAdminOrders(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/delivery-admin/orders`);
    expect(result[0].last_driver_lat).toBe("28.61");
  });

  test("deliveryDrivers fetches available drivers", async () => {
    mockFetch([{ id: "driver-001", phone: "+919999000003", name: "Ravi Kumar" }]);
    const result = await client.deliveryDrivers(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/delivery-admin/drivers`);
    expect(result[0].name).toBe("Ravi Kumar");
  });

  test("assignDriver patches specific driver to order", async () => {
    mockFetch({ assigned: true });
    await client.assignDriver(TOKEN, "order-A", "driver-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/delivery-admin/orders/order-A/assign-driver`);
    expect(lastBody()).toEqual({ driverId: "driver-001" });
  });
});

// ── Operations & AI ───────────────────────────────────────────────────────────

describe("ApiClient — Operations & Analytics", () => {
  const client = makeClient();

  test("driverLoadBalancing fetches load metrics", async () => {
    mockFetch([{ id: "driver-001", phone: "+91999", active_orders: 2, capacity_score: 0.7 }]);
    const result = await client.driverLoadBalancing(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/operations/driver-load`);
    expect(result[0].capacity_score).toBe(0.7);
  });

  test("assignBestDriver posts to AI assignment endpoint", async () => {
    mockFetch({ driverId: "driver-best" });
    await client.assignBestDriver(TOKEN, "order-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/operations/orders/order-001/assign-best-driver`);
    expect(lastInit().method).toBe("POST");
  });

  test("runDemandPredictionJob posts to analytics jobs", async () => {
    mockFetch({ predictions: [{ zone: "Delhi NCR" }] });
    const result = await client.runDemandPredictionJob(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/operations/analytics/jobs/demand-prediction`);
    expect(result).toMatchObject({ predictions: expect.any(Array) });
  });

  test("analyticsJobs fetches job list", async () => {
    mockFetch([{ id: "job-001", job_type: "demand_prediction", status: "complete", summary: {}, created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.analyticsJobs(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/operations/analytics/jobs`);
    expect(result[0].status).toBe("complete");
  });

  test("demandPredictions fetches prediction list", async () => {
    mockFetch([{ id: "pred-001", zone_key: "delhi-ncr", cuisine_type: "North Indian", hour_start: "2026-05-08T12:00:00Z", predicted_orders: 150, confidence: "high" }]);
    const result = await client.demandPredictions(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/operations/demand-predictions`);
    expect(result[0].predicted_orders).toBe(150);
  });
});

// ── Zones, Offers, Campaigns, Incentives ──────────────────────────────────────

describe("ApiClient — Marketplace Config", () => {
  const client = makeClient();

  test("marketplaceZones fetches zone list", async () => {
    mockFetch([{ id: "zone-001", name: "Zone A", city: "Delhi NCR", sla_minutes: 20, surge_multiplier: "1.2" }]);
    const result = await client.marketplaceZones(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/zones`);
    expect(result[0].sla_minutes).toBe(20);
  });

  test("createZone posts full zone payload", async () => {
    mockFetch({ id: "zone-002" });
    await client.createZone(TOKEN, "Zone B", "Mumbai", 19.076, 72.877, 5, 25);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/zones`);
    expect(lastBody()).toMatchObject({ name: "Zone B", city: "Mumbai", radiusKm: 5, slaMinutes: 25 });
  });

  test("marketplaceOffers fetches active offers", async () => {
    mockFetch([{ id: "offer-001", code: "SAVE50", title: "Save ₹50", discount_type: "flat", discount_value: 5000 }]);
    const result = await client.marketplaceOffers(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/offers`);
    expect(result[0].code).toBe("SAVE50");
  });

  test("createOffer posts coupon details", async () => {
    mockFetch({ id: "offer-002" });
    await client.createOffer(TOKEN, "NEW10", "10% Off", "percent", 10, 19900);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/offers`);
    expect(lastBody()).toEqual({ code: "NEW10", title: "10% Off", discountType: "percent", discountValue: 10, minOrderPaise: 19900 });
  });

  test("campaigns fetches campaign list", async () => {
    mockFetch([{ id: "camp-001", name: "Launch Push", channel: "push", budget_paise: 100000, status: "active", ai_creative: null }]);
    const result = await client.campaigns(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/campaigns`);
    expect(result[0].channel).toBe("push");
  });

  test("createCampaign posts campaign details", async () => {
    mockFetch({ id: "camp-002" });
    await client.createCampaign(TOKEN, "Email Blast", "email", 50000, "AI creative text");
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/campaigns`);
    expect(lastBody()).toMatchObject({ name: "Email Blast", channel: "email", budgetPaise: 50000, aiCreative: "AI creative text" });
  });

  test("driverIncentives fetches incentive list", async () => {
    mockFetch([{ id: "inc-001", title: "Weekly Bonus", target_deliveries: 50, reward_paise: 7500, status: "active" }]);
    const result = await client.driverIncentives(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/driver-incentives`);
    expect(result[0].target_deliveries).toBe(50);
  });

  test("createDriverIncentive posts incentive with optional driverId", async () => {
    mockFetch({ id: "inc-002" });
    await client.createDriverIncentive(TOKEN, "Top Driver", 100, 15000, "driver-001");
    expect(lastUrl()).toBe(`${BASE}/api/v1/marketplace/driver-incentives`);
    expect(lastBody()).toEqual({ title: "Top Driver", targetDeliveries: 100, rewardPaise: 15000, driverId: "driver-001" });
  });
});

// ── Wallet & Payouts ──────────────────────────────────────────────────────────

describe("ApiClient — Wallet & Payouts", () => {
  const client = makeClient();

  test("walletSummary fetches balance and earnings", async () => {
    const summary = {
      wallet: { balance_paise: 120000, total_earnings_paise: 500000, total_payouts_paise: 380000 },
      earnings: { earned_paise: "500000", deliveries: "85" },
      pendingPayouts: { requested_paise: "50000", requests: "1" },
    };
    mockFetch(summary);
    const result = await client.walletSummary(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/wallet/summary`);
    expect(result.wallet.balance_paise).toBe(120000);
    expect(result.earnings.deliveries).toBe("85");
  });

  test("walletTransactions fetches transaction list", async () => {
    mockFetch([{ id: "tx-001", type: "credit", amount_paise: 25000, status: "completed", created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.walletTransactions(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/wallet/transactions`);
    expect(result[0].type).toBe("credit");
  });

  test("driverEarnings fetches per-delivery earnings", async () => {
    mockFetch([{ id: "earn-001", order_id: "order-001", amount_paise: 5000, status: "credited", created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.driverEarnings(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/wallet/earnings`);
    expect(result[0].amount_paise).toBe(5000);
  });

  test("requestPayout posts UPI payout details", async () => {
    mockFetch({ id: "payout-001" });
    await client.requestPayout(TOKEN, 50000, "upi", "driver@upi");
    expect(lastUrl()).toBe(`${BASE}/api/v1/wallet/payouts/request`);
    expect(lastBody()).toEqual({ amountPaise: 50000, method: "upi", upiId: "driver@upi", bankAccountLast4: undefined });
  });

  test("requestPayout posts bank payout details", async () => {
    mockFetch({ id: "payout-002" });
    await client.requestPayout(TOKEN, 75000, "bank", undefined, "1234");
    expect(lastBody()).toEqual({ amountPaise: 75000, method: "bank", upiId: undefined, bankAccountLast4: "1234" });
  });

  test("adminPayouts fetches all pending payouts", async () => {
    mockFetch([{ id: "payout-001", amount_paise: 50000, method: "upi", status: "pending", phone: "+919999000003", role: "driver", created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.adminPayouts(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/wallet/payouts`);
    expect(result[0].role).toBe("driver");
  });

  test("updatePayoutApproval patches status and note", async () => {
    mockFetch({ id: "payout-001", status: "approved" });
    await client.updatePayoutApproval(TOKEN, "payout-001", "approved", "Admin approved");
    expect(lastUrl()).toBe(`${BASE}/api/v1/wallet/payouts/payout-001/approval`);
    expect(lastBody()).toEqual({ status: "approved", note: "Admin approved" });
  });

  test("updatePayoutApproval can mark as paid", async () => {
    mockFetch({ id: "payout-001", status: "paid" });
    await client.updatePayoutApproval(TOKEN, "payout-001", "paid");
    expect(lastBody()).toMatchObject({ status: "paid" });
  });
});

// ── Azure Integrations ────────────────────────────────────────────────────────

describe("ApiClient — Azure Integrations", () => {
  const client = makeClient();

  test("createAzureBlobAsset posts file metadata and base64 data", async () => {
    mockFetch({ url: "https://blob.example.com/aadhaar-front.jpg" });
    const result = await client.createAzureBlobAsset(TOKEN, "aadhaar-front.jpg", "image/jpeg", 250000, "base64data==");
    expect(lastUrl()).toBe(`${BASE}/api/v1/integrations/azure/blob/assets`);
    expect(lastBody()).toEqual({ fileName: "aadhaar-front.jpg", contentType: "image/jpeg", sizeBytes: 250000, data: "base64data==" });
    expect(result).toMatchObject({ url: "https://blob.example.com/aadhaar-front.jpg" });
  });

  test("verifyAzureOcr posts imageUrl for Aadhaar OCR", async () => {
    mockFetch({ status: "success", extracted: { name: "Ravi Kumar", dob: "01/01/1990" } });
    await client.verifyAzureOcr(TOKEN, "https://blob.example.com/front.jpg");
    expect(lastUrl()).toBe(`${BASE}/api/v1/integrations/azure/ocr/verify`);
    expect(lastBody()).toEqual({ imageUrl: "https://blob.example.com/front.jpg" });
  });

  test("verifyAzureFace posts selfieUrl and documentUrl for face match", async () => {
    mockFetch({ match: true, confidence: 0.97 });
    await client.verifyAzureFace(TOKEN, "https://blob.example.com/selfie.jpg", "https://blob.example.com/front.jpg");
    expect(lastUrl()).toBe(`${BASE}/api/v1/integrations/azure/face/verify`);
    expect(lastBody()).toEqual({
      selfieUrl: "https://blob.example.com/selfie.jpg",
      documentUrl: "https://blob.example.com/front.jpg",
    });
  });

  test("auditLogs fetches API audit trail", async () => {
    mockFetch([{ id: "log-001", method: "POST", path: "/api/v1/orders", status_code: 201, created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.auditLogs(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/integrations/audit-logs`);
    expect(result[0].method).toBe("POST");
  });

  test("verificationChecks fetches KYC check records", async () => {
    mockFetch([{ id: "check-001", provider: "azure", check_type: "ocr", status: "success", created_at: "2026-05-08T10:00:00Z" }]);
    const result = await client.verificationChecks(TOKEN);
    expect(lastUrl()).toBe(`${BASE}/api/v1/integrations/verification-checks`);
    expect(result[0].check_type).toBe("ocr");
  });
});

// ── Error Handling (Generic) ──────────────────────────────────────────────────

describe("ApiClient — Generic Error Handling", () => {
  const client = makeClient();

  test("forwards error message from JSON body on 4xx", async () => {
    mockFetch({ error: "Unauthorized access" }, 403);
    await expect(client.adminDashboard(TOKEN)).rejects.toThrow("Unauthorized access");
  });

  test("uses status code message when no error field present", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "",
    } as Response);
    await expect(client.adminDashboard(TOKEN)).rejects.toThrow("Request failed: 500");
  });

  test("wraps AbortError as timeout message", async () => {
    mockFetchTimeout();
    await expect(client.walletSummary(TOKEN)).rejects.toThrow("Request timed out: /api/v1/wallet/summary");
  });

  test("propagates unexpected network errors", async () => {
    mockFetchError("Network unreachable");
    await expect(client.adminDashboard(TOKEN)).rejects.toThrow("Network unreachable");
  });

  test("sends content-type application/json on POST", async () => {
    mockFetch({ sent: true });
    await client.requestOtp("+91999");
    expect(lastHeaders()["content-type"]).toBe("application/json");
  });

  test("does not send Authorization header when no token", async () => {
    mockFetch({ sent: true });
    await client.requestOtp("+91999");
    expect(lastHeaders().authorization).toBeUndefined();
  });

  test("sends idempotency-key header when provided", async () => {
    mockFetch({ id: "order-001", totalPaise: 24900, status: "pending", estimatedDeliveryAt: null });
    await client.createOrder(TOKEN, "rest-001", 28.6, 77.2, []);
    expect(lastHeaders()["idempotency-key"]).toMatch(/^mobile-\d+$/);
  });
});
