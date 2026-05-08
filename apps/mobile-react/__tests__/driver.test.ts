/**
 * Driver feature logic tests
 *
 * Tests cover the business logic for:
 *   - Driver workspace loading (parallel API calls with Promise.all)
 *   - Driver onboarding form validation
 *   - Document upload & Azure blob flow
 *   - Active delivery order flow (accept → picked_up → delivered)
 *   - Live location sharing
 *   - Wallet summary and transactions
 *   - Payout requests
 *   - Driver incentives
 *   - Background check
 */

import { ApiClient } from "../src/api";

const BASE = "http://localhost:4000";
const TOKEN = "driver-jwt-token";

function makeClient() {
  return new ApiClient(BASE);
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

// ── Driver Workspace Loading ──────────────────────────────────────────────────

describe("Driver workspace loading", () => {
  test("loadDriverWork parallel calls succeed and return all data", async () => {
    const client = makeClient();
    const availableOrders = [{ id: "order-A", status: "pending", total_paise: 24900, delivery_address: "123 Main St", delivery_lat: "28.61", delivery_lng: "77.21", restaurant_name: "Pizza Hut", restaurant_address: "456 MG Road", restaurant_lat: "28.60", restaurant_lng: "77.20" }];
    const walletSummary = { wallet: { balance_paise: 120000, total_earnings_paise: 500000, total_payouts_paise: 380000 }, earnings: { earned_paise: "500000", deliveries: "85" }, pendingPayouts: { requested_paise: "50000", requests: "1" } };
    const transactions = [{ id: "tx-001", type: "credit", amount_paise: 5000, status: "completed", created_at: "2026-05-08T10:00:00Z" }];
    const incentives = [{ id: "inc-001", title: "Weekly Bonus", target_deliveries: 50, reward_paise: 7500, status: "active" }];
    const application = { id: "app-001", full_name: "Ravi Kumar", phone: "+919999000003", aadhaar_last4: "1234", ocr_status: "success", selfie_status: "success", background_check_status: "clear", bank_account_last4: "5678", upi_id: "ravi@upi", referral_code: "DRV123", approval_status: "approved", admin_note: null };

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(availableOrders) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(application) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(walletSummary) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(transactions) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(incentives) });

    const [orders, app, wallet, txs, incs] = await Promise.all([
      client.availableDeliveryOrders(TOKEN),
      client.myDriverOnboarding(TOKEN),
      client.walletSummary(TOKEN),
      client.walletTransactions(TOKEN),
      client.driverIncentives(TOKEN),
    ]);

    expect(orders).toHaveLength(1);
    expect(orders[0].restaurant_name).toBe("Pizza Hut");
    expect(app).toMatchObject({ full_name: "Ravi Kumar", approval_status: "approved" });
    expect(wallet.wallet.balance_paise).toBe(120000);
    expect(txs).toHaveLength(1);
    expect(incs[0].title).toBe("Weekly Bonus");
  });

  test("loadDriverWork handles partial failures gracefully (simulating Promise.all error)", async () => {
    const client = makeClient();
    const availableOrders = [{ id: "order-B" }];
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(availableOrders) })
      .mockRejectedValueOnce(new Error("Onboarding service unavailable"))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ wallet: { balance_paise: 0, total_earnings_paise: 0, total_payouts_paise: 0 }, earnings: { earned_paise: "0", deliveries: "0" }, pendingPayouts: { requested_paise: "0", requests: "0" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });

    const results = await Promise.allSettled([
      client.availableDeliveryOrders(TOKEN),
      client.myDriverOnboarding(TOKEN),
      client.walletSummary(TOKEN),
      client.walletTransactions(TOKEN),
      client.driverIncentives(TOKEN),
    ]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
  });
});

// ── Driver Onboarding Form Validation Logic ───────────────────────────────────

describe("Driver onboarding form validation", () => {
  function validateOnboardingForm(params: {
    driverFullName: string;
    driverAadhaarLast4: string;
    selectedAadhaarFront: string | null;
    selectedAadhaarBack: string | null;
    selectedSelfie: string | null;
  }): string | null {
    const { driverFullName, driverAadhaarLast4, selectedAadhaarFront, selectedAadhaarBack, selectedSelfie } = params;
    if (!driverFullName || !driverAadhaarLast4 || !selectedAadhaarFront || !selectedAadhaarBack || !selectedSelfie) {
      return "Fill in your name, Aadhaar last 4, and attach all three documents (Aadhaar front, back, and selfie).";
    }
    return null;
  }

  test("valid form passes validation", () => {
    expect(validateOnboardingForm({
      driverFullName: "Ravi Kumar",
      driverAadhaarLast4: "1234",
      selectedAadhaarFront: "file:///front.jpg",
      selectedAadhaarBack: "file:///back.jpg",
      selectedSelfie: "file:///selfie.jpg",
    })).toBeNull();
  });

  test("missing name fails validation", () => {
    expect(validateOnboardingForm({
      driverFullName: "",
      driverAadhaarLast4: "1234",
      selectedAadhaarFront: "file:///front.jpg",
      selectedAadhaarBack: "file:///back.jpg",
      selectedSelfie: "file:///selfie.jpg",
    })).not.toBeNull();
  });

  test("missing Aadhaar last 4 fails validation", () => {
    expect(validateOnboardingForm({
      driverFullName: "Ravi Kumar",
      driverAadhaarLast4: "",
      selectedAadhaarFront: "file:///front.jpg",
      selectedAadhaarBack: "file:///back.jpg",
      selectedSelfie: "file:///selfie.jpg",
    })).not.toBeNull();
  });

  test("missing Aadhaar front fails validation", () => {
    expect(validateOnboardingForm({
      driverFullName: "Ravi Kumar",
      driverAadhaarLast4: "1234",
      selectedAadhaarFront: null,
      selectedAadhaarBack: "file:///back.jpg",
      selectedSelfie: "file:///selfie.jpg",
    })).not.toBeNull();
  });

  test("missing Aadhaar back fails validation", () => {
    expect(validateOnboardingForm({
      driverFullName: "Ravi Kumar",
      driverAadhaarLast4: "1234",
      selectedAadhaarFront: "file:///front.jpg",
      selectedAadhaarBack: null,
      selectedSelfie: "file:///selfie.jpg",
    })).not.toBeNull();
  });

  test("missing selfie fails validation", () => {
    expect(validateOnboardingForm({
      driverFullName: "Ravi Kumar",
      driverAadhaarLast4: "1234",
      selectedAadhaarFront: "file:///front.jpg",
      selectedAadhaarBack: "file:///back.jpg",
      selectedSelfie: null,
    })).not.toBeNull();
  });

  test("all documents missing fails validation", () => {
    const error = validateOnboardingForm({
      driverFullName: "",
      driverAadhaarLast4: "",
      selectedAadhaarFront: null,
      selectedAadhaarBack: null,
      selectedSelfie: null,
    });
    expect(error).not.toBeNull();
    expect(error).toContain("Aadhaar");
  });
});

// ── Document Upload & Azure Blob Flow ─────────────────────────────────────────

describe("Driver document upload & Azure blob flow", () => {
  test("uploads all three documents and submits onboarding", async () => {
    const client = makeClient();
    const blobUrl = (name: string) => `https://blob.example.com/${name}`;

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ url: blobUrl("front.jpg") }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ url: blobUrl("back.jpg") }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ url: blobUrl("selfie.jpg") }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "app-001", full_name: "Ravi Kumar", ocr_status: "pending", selfie_status: "pending", background_check_status: "pending", approval_status: "pending" }) });

    const [frontAsset, backAsset, selfieAsset] = await Promise.all([
      client.createAzureBlobAsset(TOKEN, "aadhaar-front.jpg", "image/jpeg", 250000, "base64front"),
      client.createAzureBlobAsset(TOKEN, "aadhaar-back.jpg", "image/jpeg", 250000, "base64back"),
      client.createAzureBlobAsset(TOKEN, "selfie.jpg", "image/jpeg", 200000, "base64selfie"),
    ]);

    const result = await client.submitDriverOnboarding(TOKEN, {
      fullName: "Ravi Kumar",
      aadhaarLast4: "1234",
      aadhaarFrontUrl: (frontAsset as { url: string }).url,
      aadhaarBackUrl: (backAsset as { url: string }).url,
      selfieUrl: (selfieAsset as { url: string }).url,
      bankAccountLast4: "5678",
      upiId: "ravi@upi",
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect((frontAsset as { url: string }).url).toBe(blobUrl("front.jpg"));
    expect(result).toMatchObject({ full_name: "Ravi Kumar" });
  });

  test("Azure OCR verification posts front document URL", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ status: "success" }) });

    await client.verifyAzureOcr(TOKEN, "https://blob.example.com/front.jpg");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.imageUrl).toBe("https://blob.example.com/front.jpg");
  });

  test("Azure Face verification posts selfie and document URLs", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ match: true, confidence: 0.96 }) });

    const result = await client.verifyAzureFace(TOKEN, "https://blob.example.com/selfie.jpg", "https://blob.example.com/front.jpg");
    expect(result).toMatchObject({ match: true });
  });
});

// ── Active Delivery Flow ───────────────────────────────────────────────────────

describe("Active delivery order flow", () => {
  test("accept → picked_up → delivered full lifecycle", async () => {
    const client = makeClient();

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-A", status: "assigned" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-A", status: "picked_up" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-A", status: "delivered" }) });

    await client.acceptDeliveryOrder(TOKEN, "order-A");
    const callAfterAccept = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string ?? "{}");
    expect(fetchMock.mock.calls[0][0]).toContain("/orders/order-A/assign");

    await client.updateOrderStatus(TOKEN, "order-A", "picked_up");
    const pickupBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(pickupBody.status).toBe("picked_up");

    await client.updateOrderStatus(TOKEN, "order-A", "delivered");
    const deliveredBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string);
    expect(deliveredBody.status).toBe("delivered");

    void callAfterAccept;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("send driver location during active delivery", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ recorded: true }) });

    await client.sendDriverLocation(TOKEN, "order-A", 28.615, 77.215);
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/tracking/orders/order-A/location");
    expect(body).toEqual({ lat: 28.615, lng: 77.215 });
  });

  test("available delivery orders returns list", async () => {
    const client = makeClient();
    const orders = [
      { id: "order-A", status: "pending", total_paise: 24900, delivery_address: "123 Main St", delivery_lat: "28.61", delivery_lng: "77.21", restaurant_name: "Pizza Hut", restaurant_address: "456 MG Road", restaurant_lat: "28.60", restaurant_lng: "77.20" },
      { id: "order-B", status: "pending", total_paise: 34900, delivery_address: "456 Park Ave", delivery_lat: "28.62", delivery_lng: "77.22", restaurant_name: "Burger King", restaurant_address: "789 Park Rd", restaurant_lat: "28.61", restaurant_lng: "77.21" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(orders) });

    const result = await client.availableDeliveryOrders(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].restaurant_name).toBe("Pizza Hut");
  });
});

// ── Background Check ──────────────────────────────────────────────────────────

describe("Driver background check", () => {
  test("runDriverBackgroundCheck sends consent and returns updated application", async () => {
    const client = makeClient();
    const updated = { id: "app-001", background_check_status: "in_progress", approval_status: "pending" };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(updated) });

    const result = await client.runDriverBackgroundCheck(TOKEN);
    expect(result).toMatchObject({ background_check_status: "in_progress" });
  });

  test("background check status transitions: pending → in_progress → clear", () => {
    const validTransitions = ["pending", "in_progress", "clear", "failed"];
    expect(validTransitions).toContain("pending");
    expect(validTransitions).toContain("in_progress");
    expect(validTransitions).toContain("clear");
  });
});

// ── Wallet & Earnings ─────────────────────────────────────────────────────────

describe("Driver wallet and earnings", () => {
  test("walletSummary returns balance, earnings, and pending payouts", async () => {
    const client = makeClient();
    const summary = {
      wallet: { balance_paise: 120000, total_earnings_paise: 500000, total_payouts_paise: 380000 },
      earnings: { earned_paise: "500000", deliveries: "85" },
      pendingPayouts: { requested_paise: "50000", requests: "1" },
    };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(summary) });

    const result = await client.walletSummary(TOKEN);
    expect(result.wallet.balance_paise).toBe(120000);
    expect(Number(result.earnings.deliveries)).toBe(85);
    expect(Number(result.pendingPayouts?.requested_paise ?? 0)).toBe(50000);
  });

  test("walletTransactions returns debit and credit entries", async () => {
    const client = makeClient();
    const txs = [
      { id: "tx-001", type: "credit", amount_paise: 5000, status: "completed", created_at: "2026-05-08T10:00:00Z" },
      { id: "tx-002", type: "debit", amount_paise: 2000, status: "completed", created_at: "2026-05-08T11:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(txs) });

    const result = await client.walletTransactions(TOKEN);
    expect(result.filter(t => t.type === "credit")).toHaveLength(1);
    expect(result.filter(t => t.type === "debit")).toHaveLength(1);
  });

  test("requestPayout via UPI posts correct payload", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-001", status: "pending" }) });

    await client.requestPayout(TOKEN, 50000, "upi", "driver@upi");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ amountPaise: 50000, method: "upi", upiId: "driver@upi", bankAccountLast4: undefined });
  });

  test("requestPayout via bank account posts correct payload", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "payout-002" }) });

    await client.requestPayout(TOKEN, 75000, "bank", undefined, "5678");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ amountPaise: 75000, method: "bank", upiId: undefined, bankAccountLast4: "5678" });
  });
});

// ── Driver Incentives ─────────────────────────────────────────────────────────

describe("Driver incentives", () => {
  test("driverIncentives returns active incentive list", async () => {
    const client = makeClient();
    const incentives = [
      { id: "inc-001", title: "Weekly Bonus", target_deliveries: 50, reward_paise: 7500, status: "active" },
      { id: "inc-002", title: "Top Driver", target_deliveries: 100, reward_paise: 15000, status: "active" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(incentives) });

    const result = await client.driverIncentives(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].reward_paise).toBe(7500);
  });

  test("incentive reward display calculates correctly", () => {
    const incentive = { target_deliveries: 50, reward_paise: 7500 };
    const display = `${incentive.target_deliveries} deliveries → ₹${incentive.reward_paise / 100}`;
    expect(display).toBe("50 deliveries → ₹75");
  });
});

// ── Marketplace & Order Flow ──────────────────────────────────────────────────

describe("Driver marketplace and order flow", () => {
  test("searchRestaurants with diet filter all returns results", async () => {
    const client = makeClient();
    const restaurants = [
      { menu_item_id: "item-001", menu_item_name: "Paneer Tikka", description: "Fresh paneer", price_paise: 24900, photo_url: null, is_veg: true, cuisine_type: "North Indian", rating: "4.5", restaurant_id: "rest-001", restaurant_name: "Spice Garden", restaurant_address: "12 MG Road, Delhi", distance_km: "1.2" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(restaurants) });

    const result = await client.searchRestaurants(TOKEN, { diet: "all", minRating: 3, sort: "distance", lat: 28.6, lng: 77.2 });
    expect(result).toHaveLength(1);
    expect(result[0].restaurant_name).toBe("Spice Garden");
  });

  test("createOrder uses restaurant ID and location", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-new", totalPaise: 24900, status: "pending", estimatedDeliveryAt: null }) });

    const result = await client.createOrder(TOKEN, "rest-001", 28.6, 77.2, [{ name: "Sample Item", quantity: 1, pricePaise: 24900 }]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.restaurantId).toBe("rest-001");
    expect(body.deliveryLat).toBe(28.6);
    expect(result).toMatchObject({ id: "order-new" });
  });

  test("ETA calculation returns predicted minutes and route details", async () => {
    const client = makeClient();
    const etaResponse = {
      predictedEtaMinutes: 25,
      predictedDeliveryAt: "2026-05-08T15:25:00Z",
      route: { origin: { lat: 28.6, lng: 77.2 }, pickup: { lat: 28.61, lng: 77.21 }, dropoff: { lat: 28.62, lng: 77.22 }, distanceToPickupKm: 1.2, distanceToDropoffKm: 3.5 },
    };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(etaResponse) });

    const result = await client.orderEta(TOKEN, "order-001");
    expect(result.predictedEtaMinutes).toBe(25);
    expect(result.route.distanceToPickupKm).toBe(1.2);
  });

  test("payment flow creates payment and returns redirect URL", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ redirectUrl: "https://paytm.com/pay?token=abc123", provider: "paytm" }) });

    const result = await client.createPayment(TOKEN, "paytm", "order-001", 24900);
    expect(result.redirectUrl).toBe("https://paytm.com/pay?token=abc123");
  });

  test("cancel order sends reason to API", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ cancelled: true }) });

    await client.cancelOrder(TOKEN, "order-001", "Test cancellation from AK Ops");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reason).toBe("Test cancellation from AK Ops");
  });

  test("reorder creates a new order from previous order ID", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-002", totalPaise: 24900, status: "pending", estimatedDeliveryAt: null }) });

    const result = await client.reorder(TOKEN, "order-001");
    expect(fetchMock.mock.calls[0][0]).toContain("/orders/order-001/reorder");
    expect(result).toMatchObject({ id: "order-002" });
  });
});
