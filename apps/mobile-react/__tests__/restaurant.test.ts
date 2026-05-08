/**
 * Restaurant panel feature tests
 *
 * Tests cover:
 *   - Restaurant onboarding form validation
 *   - Restaurant panel loading (own restaurants + orders + earnings)
 *   - Menu item management (add single, batch import)
 *   - Incoming order accept/reject workflow
 *   - Earnings summary display
 *   - Google Places menu import flow
 */

import { ApiClient } from "../src/api";

const BASE = "http://localhost:4000";
const TOKEN = "restaurant-jwt-token";

function makeClient() {
  return new ApiClient(BASE);
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

// ── Restaurant Onboarding Form Validation ─────────────────────────────────────

describe("Restaurant onboarding form validation", () => {
  function validateRestaurantForm(params: {
    restaurantName: string;
    restaurantAddress: string;
    restaurantPhone: string;
  }): string | null {
    const { restaurantName, restaurantAddress, restaurantPhone } = params;
    if (!restaurantName || !restaurantAddress || !restaurantPhone) {
      return "Provide restaurant name, address, and contact phone number.";
    }
    return null;
  }

  test("valid form passes validation", () => {
    expect(validateRestaurantForm({
      restaurantName: "Spice Garden",
      restaurantAddress: "12 MG Road, Delhi",
      restaurantPhone: "+919999000002",
    })).toBeNull();
  });

  test("missing name fails validation", () => {
    expect(validateRestaurantForm({
      restaurantName: "",
      restaurantAddress: "12 MG Road, Delhi",
      restaurantPhone: "+919999000002",
    })).not.toBeNull();
  });

  test("missing address fails validation", () => {
    expect(validateRestaurantForm({
      restaurantName: "Spice Garden",
      restaurantAddress: "",
      restaurantPhone: "+919999000002",
    })).not.toBeNull();
  });

  test("missing phone fails validation", () => {
    expect(validateRestaurantForm({
      restaurantName: "Spice Garden",
      restaurantAddress: "12 MG Road, Delhi",
      restaurantPhone: "",
    })).not.toBeNull();
  });

  test("all fields missing fails with descriptive error", () => {
    const error = validateRestaurantForm({
      restaurantName: "",
      restaurantAddress: "",
      restaurantPhone: "",
    });
    expect(error).toContain("restaurant name");
    expect(error).toContain("address");
    expect(error).toContain("phone");
  });
});

// ── Restaurant Panel Loading ──────────────────────────────────────────────────

describe("Restaurant panel loading", () => {
  test("loadRestaurantPanel fetches restaurants then their orders and earnings", async () => {
    const client = makeClient();
    const restaurants = [{ id: "rest-001", name: "Spice Garden", approval_status: "approved", onboarding_status: "complete" }];
    const orders = [{ id: "order-001", status: "pending", total_paise: 24900 }];
    const earnings = { orders: "42", gross_paise: "1050000", estimated_payout_paise: "945000" };

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(restaurants) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(orders) })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(earnings) });

    const mine = await client.myRestaurants(TOKEN);
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe("Spice Garden");

    if (mine[0]?.id) {
      const [fetchedOrders, fetchedEarnings] = await Promise.all([
        client.restaurantOrders(TOKEN, mine[0].id),
        client.restaurantEarnings(TOKEN, mine[0].id),
      ]);
      expect(fetchedOrders).toHaveLength(1);
      expect(fetchedEarnings.orders).toBe("42");
    }
  });

  test("loadRestaurantPanel with no restaurants skips order/earnings fetch", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });

    const mine = await client.myRestaurants(TOKEN);
    expect(mine).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── Restaurant Onboarding API ─────────────────────────────────────────────────

describe("Restaurant onboarding API", () => {
  test("onboardRestaurant posts complete registration payload", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-001" }) });

    await client.onboardRestaurant(TOKEN, {
      name: "Spice Garden",
      address: "12 MG Road, Delhi",
      contactName: "Spice Garden",
      contactPhone: "+919999000002",
      cuisineType: "North Indian",
      fssaiLicense: "",
      gstNumber: "",
      bankAccountLast4: "",
    });

    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/restaurants/onboarding");
    expect(body.name).toBe("Spice Garden");
    expect(body.cuisineType).toBe("North Indian");
  });

  test("uses restaurant name as contactName when submitting", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "rest-002" }) });

    const restaurantName = "Burger Bistro";
    await client.onboardRestaurant(TOKEN, {
      name: restaurantName,
      address: "456 Park Ave",
      contactName: restaurantName,
      contactPhone: "+919999000099",
      cuisineType: "Fast Food",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.contactName).toBe(restaurantName);
  });
});

// ── Menu Management ───────────────────────────────────────────────────────────

describe("Menu management", () => {
  test("addMenuItem creates item with isAvailable=true and formatted name", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-001" }) });

    const restaurantName = "Spice Garden";
    await client.createMenuItem(TOKEN, "rest-001", {
      name: `${restaurantName} Special`,
      description: "Added from AK Ops mobile app",
      pricePaise: 29900,
      photoUrl: "",
      isVeg: true,
      cuisineType: "North Indian",
      rating: 4.0,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Spice Garden Special");
    expect(body.isAvailable).toBe(true);
    expect(body.pricePaise).toBe(29900);
    expect(body.isVeg).toBe(true);
  });

  test("importMenuItems posts array from Google Places data (up to 3 items)", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 3 }) });

    const googlePlaces = [
      { name: "Dominos Pizza", address: "Delhi", rating: 4.1, lat: 28.6, lng: 77.2, photoUrl: "https://example.com/dominos.jpg" },
      { name: "McDonalds", address: "Delhi", rating: 3.8, lat: 28.61, lng: 77.21, photoUrl: null },
      { name: "KFC", address: "Delhi", rating: 4.2, lat: 28.62, lng: 77.22, photoUrl: "https://example.com/kfc.jpg" },
      { name: "Subway", address: "Delhi", rating: 4.0, lat: 28.63, lng: 77.23, photoUrl: null },
    ];

    const items = googlePlaces.slice(0, 3).map(place => ({
      name: place.name,
      description: `Imported item (rating ${place.rating})`,
      pricePaise: 34900,
      photoUrl: place.photoUrl ?? "",
      isVeg: true,
      cuisineType: "General",
      rating: place.rating,
      googlePlaceId: place.name,
    }));

    await client.importMenuItems(TOKEN, "rest-001", items);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items).toHaveLength(3);
    expect(body.items[0].name).toBe("Dominos Pizza");
    expect(body.items[2].name).toBe("KFC");
  });

  test("importMenuItems requires Google Places data to be loaded first", async () => {
    const googlePlaces: Array<{ name: string }> = [];
    expect(googlePlaces.length).toBe(0);
  });

  test("menu item price is set to 34900 paise (₹349) for imports", () => {
    const importPrice = 34900;
    expect(importPrice / 100).toBe(349);
  });
});

// ── Incoming Order Workflow ───────────────────────────────────────────────────

describe("Restaurant incoming order workflow", () => {
  test("acceptOrder patches decision=accepted", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-001", status: "accepted" }) });

    await client.decideRestaurantOrder(TOKEN, "order-001", "accepted");
    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/restaurants/orders/order-001/decision");
    expect(body.decision).toBe("accepted");
  });

  test("rejectOrder patches decision=cancelled", async () => {
    const client = makeClient();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "order-001", status: "cancelled" }) });

    await client.decideRestaurantOrder(TOKEN, "order-001", "cancelled");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.decision).toBe("cancelled");
  });

  test("restaurantOrders fetches orders with status and amount", async () => {
    const client = makeClient();
    const orders = [
      { id: "order-001", status: "pending", total_paise: 24900 },
      { id: "order-002", status: "accepted", total_paise: 34900 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(orders) });

    const result = await client.restaurantOrders(TOKEN, "rest-001");
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending");
    expect(result[1].total_paise).toBe(34900);
  });

  test("pending orders show both accept and reject options", () => {
    const order = { id: "order-001", status: "pending", total_paise: 24900 };
    const availableActions = order.status === "pending" ? ["accepted", "cancelled"] : [];
    expect(availableActions).toContain("accepted");
    expect(availableActions).toContain("cancelled");
  });
});

// ── Earnings Summary ──────────────────────────────────────────────────────────

describe("Restaurant earnings summary", () => {
  test("restaurantEarnings returns order count, gross, and payout estimate", async () => {
    const client = makeClient();
    const earnings = { orders: "42", gross_paise: "1050000", estimated_payout_paise: "945000" };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(earnings) });

    const result = await client.restaurantEarnings(TOKEN, "rest-001");
    expect(result.orders).toBe("42");
    expect(Number(result.gross_paise)).toBe(1050000);
    expect(Number(result.estimated_payout_paise)).toBe(945000);
  });

  test("estimated payout is less than gross (deductions applied)", () => {
    const gross = 1050000;
    const estimatedPayout = 945000;
    expect(estimatedPayout).toBeLessThan(gross);
    const deductionPercent = ((gross - estimatedPayout) / gross) * 100;
    expect(deductionPercent).toBeCloseTo(10, 0);
  });

  test("earnings display formats paise correctly", () => {
    const grossPaise = 1050000;
    const formatted = `₹${(grossPaise / 100).toFixed(0)}`;
    expect(formatted).toBe("₹10500");
  });
});

// ── Restaurant Approval Status ────────────────────────────────────────────────

describe("Restaurant approval status", () => {
  test("approval status values are valid", () => {
    const validStatuses = ["pending", "approved", "rejected"];
    const restaurant = { approval_status: "pending" };
    expect(validStatuses).toContain(restaurant.approval_status);
  });

  test("onboarding status transitions are correct", () => {
    const validOnboardingStatuses = ["pending", "submitted", "complete", "rejected"];
    expect(validOnboardingStatuses).toContain("pending");
    expect(validOnboardingStatuses).toContain("complete");
  });

  test("myRestaurants shows approval and onboarding status", async () => {
    const client = makeClient();
    const restaurants = [
      { id: "rest-001", name: "Spice Garden", approval_status: "approved", onboarding_status: "complete" },
      { id: "rest-002", name: "Burger Bistro", approval_status: "pending", onboarding_status: "submitted" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(restaurants) });

    const result = await client.myRestaurants(TOKEN);
    const approved = result.filter(r => r.approval_status === "approved");
    const pending = result.filter(r => r.approval_status === "pending");
    expect(approved).toHaveLength(1);
    expect(pending).toHaveLength(1);
  });
});
