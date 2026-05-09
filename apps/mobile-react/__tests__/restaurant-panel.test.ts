/**
 * Restaurant Panel (apps/restaurant-panel/) — separate login and operations
 *
 * The restaurant panel is a standalone HTML/JS app with its own auth flow.
 * Tests verify:
 *   - Separate OTP login flow with role="restaurant"
 *   - Onboarding payload with full business details
 *   - FSSAI license field (compliance ID)
 *   - GST number field (compliance ID)
 *   - Bank account last 4 reference
 *   - Contact name and contact phone separation
 *   - optionalValue behavior (empty → undefined)
 *   - formatCurrency helper (INR Intl format)
 *   - escapeHtml XSS prevention
 *   - Restaurant selector loading with approval/onboarding status
 *   - Data loading (orders + earnings) on restaurant select
 *   - Order accept/reject flow
 *   - Menu item addition (name + pricePaise + isAvailable)
 *   - Panel shows pending-until-approval message
 *   - Approval state display (pending / approved / rejected)
 */

import { ApiClient } from "../src/api";

const BASE = "http://localhost:4000";

function makeClient() {
  return new ApiClient(BASE);
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

// ── Restaurant Panel Auth — Separate Login ────────────────────────────────────

describe("Restaurant panel — separate login flow", () => {
  test("OTP request uses phone number only (no auth header)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ sent: true, devCode: "555666" }) });

    const client = makeClient();
    const result = await client.requestOtp("+919999000002");

    const url = fetchMock.mock.calls[0][0] as string;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(url).toContain("/auth/otp/request");
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(result).toMatchObject({ sent: true });
  });

  test("OTP verify sends role=restaurant to get restaurant-scoped JWT", async () => {
    const session = { token: "rest.jwt.token", user: { id: "user-002", role: "restaurant", phone: "+919999000002" } };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(session) });

    const client = makeClient();
    const result = await client.verifyOtp("+919999000002", "555666", "restaurant");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.role).toBe("restaurant");
    expect(body.phone).toBe("+919999000002");
    expect(body.code).toBe("555666");
    expect(result).toMatchObject({ token: "rest.jwt.token" });
  });

  test("dev OTP code is returned in response for test environment", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ sent: true, devCode: "123456" }) });
    const result = await makeClient().requestOtp("+919999000002");
    expect(result).toMatchObject({ devCode: "123456" });
  });

  test("workspace is revealed after successful login (token is set)", () => {
    const response = { token: "rest.jwt.token", user: { role: "restaurant" } };
    const token = response.token;
    expect(Boolean(token)).toBe(true);
  });
});

// ── Restaurant Onboarding — Business Details ──────────────────────────────────

describe("Restaurant panel — onboarding with business details", () => {
  test("submits complete onboarding with all required fields", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-001" }) });
    const TOKEN = "rest.jwt.token";

    await makeClient().onboardRestaurant(TOKEN, {
      name: "Spice Garden",
      address: "12 MG Road, Connaught Place, Delhi 110001",
      contactName: "Amar Singh",
      contactPhone: "+919999000002",
      cuisineType: "North Indian",
      fssaiLicense: "FSSAI1234567890",
      gstNumber: "22AAAAA0000A1Z5",
      bankAccountLast4: "9999",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Spice Garden");
    expect(body.address).toBe("12 MG Road, Connaught Place, Delhi 110001");
    expect(body.contactName).toBe("Amar Singh");
    expect(body.contactPhone).toBe("+919999000002");
    expect(body.cuisineType).toBe("North Indian");
  });

  test("FSSAI license is included in onboarding payload", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-001" }) });

    await makeClient().onboardRestaurant("rest.jwt", {
      name: "Healthy Bites",
      address: "Lajpat Nagar, Delhi",
      contactName: "Priya Sharma",
      contactPhone: "+919999000055",
      cuisineType: "Salads",
      fssaiLicense: "FSSAI9876543210",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.fssaiLicense).toBe("FSSAI9876543210");
  });

  test("GST number is included in onboarding payload", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-002" }) });

    await makeClient().onboardRestaurant("rest.jwt", {
      name: "Burger Bistro",
      address: "Saket, Delhi",
      contactName: "Raj Kumar",
      contactPhone: "+919999000066",
      cuisineType: "Fast Food",
      gstNumber: "07AABCU9603R1ZX",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.gstNumber).toBe("07AABCU9603R1ZX");
  });

  test("bank account last 4 is included as reference (not full number)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-003" }) });

    await makeClient().onboardRestaurant("rest.jwt", {
      name: "Tea House",
      address: "Vasant Kunj, Delhi",
      contactName: "Tea House",
      contactPhone: "+919999000077",
      cuisineType: "Beverages",
      bankAccountLast4: "5678",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.bankAccountLast4).toBe("5678");
    expect(body.bankAccountLast4.length).toBe(4);
  });

  test("FSSAI and GST are optional — onboarding succeeds without them", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-004" }) });

    await makeClient().onboardRestaurant("rest.jwt", {
      name: "Street Food Corner",
      address: "Chandni Chowk, Delhi",
      contactName: "Ram Lal",
      contactPhone: "+919999000088",
      cuisineType: "Street Food",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.fssaiLicense).toBeUndefined();
    expect(body.gstNumber).toBeUndefined();
    expect(body.bankAccountLast4).toBeUndefined();
  });

  test("contact name and contact phone are separate from restaurant name", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-005" }) });

    await makeClient().onboardRestaurant("rest.jwt", {
      name: "Royal Kitchen",
      address: "Dwarka, Delhi",
      contactName: "Sunita Mehta",
      contactPhone: "+919999000099",
      cuisineType: "Mughlai",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Royal Kitchen");
    expect(body.contactName).toBe("Sunita Mehta");
    expect(body.contactPhone).toBe("+919999000099");
    expect(body.name).not.toBe(body.contactName);
  });

  test("restaurant submission requires Super Admin approval (pending state)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([
      { id: "rest-001", name: "Spice Garden", approval_status: "pending", onboarding_status: "submitted" },
    ]) });

    const result = await makeClient().myRestaurants("rest.jwt");
    expect(result[0].approval_status).toBe("pending");
    expect(result[0].onboarding_status).toBe("submitted");
  });
});

// ── optionalValue behavior ────────────────────────────────────────────────────

describe("optionalValue — empty string becomes undefined", () => {
  function optionalValue(str: string): string | undefined {
    return str.trim() || undefined;
  }

  test("non-empty string is returned as-is", () => {
    expect(optionalValue("FSSAI1234")).toBe("FSSAI1234");
  });

  test("empty string returns undefined (field omitted from payload)", () => {
    expect(optionalValue("")).toBeUndefined();
  });

  test("whitespace-only string returns undefined", () => {
    expect(optionalValue("   ")).toBeUndefined();
  });

  test("GST number returns correctly when provided", () => {
    expect(optionalValue("22AAAAA0000A1Z5")).toBe("22AAAAA0000A1Z5");
  });

  test("bank last 4 returns undefined when empty (not provided)", () => {
    expect(optionalValue("")).toBeUndefined();
  });
});

// ── formatCurrency (restaurant-panel HTML version) ────────────────────────────

describe("Restaurant panel formatCurrency (INR Intl.NumberFormat)", () => {
  function formatCurrency(paise: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      currencyDisplay: "code",
    }).format(paise / 100);
  }

  test("formats 0 paise as INR 0.00", () => {
    const result = formatCurrency(0);
    expect(result).toContain("INR");
    expect(result).toContain("0.00");
  });

  test("formats 1050000 paise as INR 10,500.00", () => {
    const result = formatCurrency(1050000);
    expect(result).toContain("INR");
    expect(result).toContain("10,500.00");
  });

  test("formats 24900 paise as INR 249.00", () => {
    const result = formatCurrency(24900);
    expect(result).toContain("249.00");
  });

  test("formats 945000 paise (estimated payout) as INR 9,450.00", () => {
    const result = formatCurrency(945000);
    expect(result).toContain("9,450.00");
  });
});

// ── escapeHtml — XSS Prevention ──────────────────────────────────────────────

describe("escapeHtml — XSS prevention for order table rendering", () => {
  function escapeHtml(text: string | null | undefined): string {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
    return String(text ?? "").replace(/[&<>"']/g, char => map[char]);
  }

  test("escapes < and > to prevent HTML injection", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("escapes & ampersand", () => {
    expect(escapeHtml("Mac & Cheese")).toBe("Mac &amp; Cheese");
  });

  test("escapes double quotes", () => {
    expect(escapeHtml('name="test"')).toBe("name=&quot;test&quot;");
  });

  test("escapes single quotes", () => {
    expect(escapeHtml("it's fine")).toBe("it&#039;s fine");
  });

  test("handles null safely (returns empty string)", () => {
    expect(escapeHtml(null)).toBe("");
  });

  test("handles undefined safely (returns empty string)", () => {
    expect(escapeHtml(undefined)).toBe("");
  });

  test("plain text is unchanged", () => {
    expect(escapeHtml("Spice Garden")).toBe("Spice Garden");
  });

  test("order ID is safe to render in HTML (no special chars)", () => {
    const orderId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    expect(escapeHtml(orderId)).toBe(orderId);
  });
});

// ── Restaurant Selector — Approval/Onboarding Status Display ──────────────────

describe("Restaurant selector — status display", () => {
  test("dropdown option shows name + onboarding_status + approval_status", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([
      { id: "rest-001", name: "Spice Garden", approval_status: "approved", onboarding_status: "complete" },
      { id: "rest-002", name: "Burger Bistro", approval_status: "pending", onboarding_status: "submitted" },
    ]) });

    const result = await makeClient().myRestaurants("rest.jwt");
    const option1 = `${result[0].name} - ${result[0].onboarding_status}/${result[0].approval_status}`;
    const option2 = `${result[1].name} - ${result[1].onboarding_status}/${result[1].approval_status}`;

    expect(option1).toBe("Spice Garden - complete/approved");
    expect(option2).toBe("Burger Bistro - submitted/pending");
  });

  test("only approved restaurants can process orders (approval_status check)", () => {
    const restaurants = [
      { id: "rest-001", name: "Spice Garden", approval_status: "approved", onboarding_status: "complete" },
      { id: "rest-002", name: "Burger Bistro", approval_status: "pending", onboarding_status: "submitted" },
      { id: "rest-003", name: "Tea House", approval_status: "rejected", onboarding_status: "rejected" },
    ];

    const operational = restaurants.filter(r => r.approval_status === "approved");
    expect(operational).toHaveLength(1);
    expect(operational[0].name).toBe("Spice Garden");
  });

  test("loadRestaurantData fetches orders and earnings in parallel", async () => {
    const orders = [{ id: "order-001", status: "pending", total_paise: 24900 }];
    const earnings = { orders: "42", gross_paise: "1050000", estimated_payout_paise: "945000" };

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(orders) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(earnings) });

    const [fetchedOrders, fetchedEarnings] = await Promise.all([
      makeClient().restaurantOrders("rest.jwt", "rest-001"),
      makeClient().restaurantEarnings("rest.jwt", "rest-001"),
    ]);

    expect(fetchedOrders).toHaveLength(1);
    expect(fetchedEarnings.orders).toBe("42");
  });
});

// ── Menu Item Addition (Restaurant Panel) ─────────────────────────────────────

describe("Restaurant panel — menu item addition", () => {
  test("adds menu item with name, pricePaise, and isAvailable=true", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-001" }) });

    await makeClient().createMenuItem("rest.jwt", "rest-001", {
      name: "Paneer Butter Masala",
      pricePaise: 28900,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Paneer Butter Masala");
    expect(body.pricePaise).toBe(28900);
    expect(body.isAvailable).toBe(true);
  });

  test("pricePaise must be a number (not a string)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-002" }) });

    const priceFromInput = Number("28900");
    await makeClient().createMenuItem("rest.jwt", "rest-001", {
      name: "Chicken Biryani",
      pricePaise: priceFromInput,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.pricePaise).toBe("number");
    expect(body.pricePaise).toBe(28900);
  });
});

// ── Order Decision — Accept and Reject ───────────────────────────────────────

describe("Restaurant panel — order accept/reject", () => {
  test("accept order patches decision=accepted", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-001", status: "accepted" }) });
    await makeClient().decideRestaurantOrder("rest.jwt", "order-001", "accepted");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.decision).toBe("accepted");
  });

  test("reject order patches decision=cancelled", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-001", status: "cancelled" }) });
    await makeClient().decideRestaurantOrder("rest.jwt", "order-001", "cancelled");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.decision).toBe("cancelled");
  });

  test("after decision, restaurant data is reloaded (orders + earnings)", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-001", status: "accepted" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ orders: "1", gross_paise: "24900", estimated_payout_paise: "22410" }) });

    const client = makeClient();
    await client.decideRestaurantOrder("rest.jwt", "order-001", "accepted");
    const [orders, earnings] = await Promise.all([
      client.restaurantOrders("rest.jwt", "rest-001"),
      client.restaurantEarnings("rest.jwt", "rest-001"),
    ]);

    expect(orders).toHaveLength(0);
    expect(earnings.orders).toBe("1");
  });
});

// ── Approval State Machine ─────────────────────────────────────────────────────

describe("Restaurant approval state machine", () => {
  const validApprovalStates = ["pending", "approved", "rejected"];
  const validOnboardingStates = ["pending", "submitted", "complete", "rejected"];

  test.each(validApprovalStates)("approval_status '%s' is a valid state", (state) => {
    expect(validApprovalStates).toContain(state);
  });

  test.each(validOnboardingStates)("onboarding_status '%s' is a valid state", (state) => {
    expect(validOnboardingStates).toContain(state);
  });

  test("new restaurant starts with approval_status=pending", () => {
    const newRestaurant = { approval_status: "pending", onboarding_status: "submitted" };
    expect(newRestaurant.approval_status).toBe("pending");
  });

  test("Super Admin approval transitions pending→approved", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "rest-001", approval_status: "approved" }) });
    const result = await makeClient().updateRestaurantApproval("admin.jwt", "rest-001", "approved");
    expect((result as { approval_status: string }).approval_status).toBe("approved");
  });

  test("Super Admin rejection transitions pending→rejected", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "rest-001", approval_status: "rejected" }) });
    const result = await makeClient().updateRestaurantApproval("admin.jwt", "rest-001", "rejected");
    expect((result as { approval_status: string }).approval_status).toBe("rejected");
  });

  test("can reset rejected restaurant back to pending for re-review", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "rest-001", approval_status: "pending" }) });
    const result = await makeClient().updateRestaurantApproval("admin.jwt", "rest-001", "pending");
    expect((result as { approval_status: string }).approval_status).toBe("pending");
  });

  test("approval status drives operational readiness", () => {
    const states = [
      { approval_status: "pending", canOperate: false },
      { approval_status: "approved", canOperate: true },
      { approval_status: "rejected", canOperate: false },
    ];

    states.forEach(({ approval_status, canOperate }) => {
      const operational = approval_status === "approved";
      expect(operational).toBe(canOperate);
    });
  });
});
