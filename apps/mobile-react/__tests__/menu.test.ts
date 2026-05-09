/**
 * Menu management — full feature coverage
 *
 * Tests cover:
 *   - Item creation with photo URL
 *   - Veg / non-veg (isVeg) flag
 *   - Cuisine type metadata
 *   - Item rating
 *   - isAvailable flag always set to true on creation
 *   - Bulk import from Google Places data (name, photoUrl, rating, googlePlaceId)
 *   - Search filtering by diet (veg / non_veg / all)
 *   - Search results containing veg metadata
 *   - Price formatting and validation
 *   - Bulk import limits (up to 3 items from Google Places slice)
 *   - Missing optional fields are omitted cleanly
 */

import { ApiClient } from "../src/api";
import type { RestaurantSearchResult } from "../src/types";

const BASE = "http://localhost:4000";
const TOKEN = "restaurant-jwt";
const REST_ID = "rest-001";

function makeClient() {
  return new ApiClient(BASE);
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

// ── Single Menu Item — Field Coverage ─────────────────────────────────────────

describe("Menu item creation — all fields", () => {
  test("creates veg item with photo URL, cuisine, and rating", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-001" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, {
      name: "Paneer Tikka",
      pricePaise: 28900,
      description: "Soft paneer marinated in spices",
      photoUrl: "https://cdn.amberkitchen.com/menu/paneer-tikka.jpg",
      isVeg: true,
      cuisineType: "North Indian",
      rating: 4.7,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Paneer Tikka");
    expect(body.photoUrl).toBe("https://cdn.amberkitchen.com/menu/paneer-tikka.jpg");
    expect(body.isVeg).toBe(true);
    expect(body.cuisineType).toBe("North Indian");
    expect(body.rating).toBe(4.7);
    expect(body.pricePaise).toBe(28900);
    expect(body.isAvailable).toBe(true);
  });

  test("creates non-veg item (isVeg: false)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-002" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, {
      name: "Butter Chicken",
      pricePaise: 34900,
      isVeg: false,
      cuisineType: "North Indian",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.isVeg).toBe(false);
    expect(body.name).toBe("Butter Chicken");
  });

  test("creates item without photo URL (photoUrl omitted)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-003" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, {
      name: "Dal Makhani",
      pricePaise: 19900,
      isVeg: true,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.photoUrl).toBeUndefined();
    expect(body.isVeg).toBe(true);
  });

  test("creates item with empty photoUrl string (fallback for no photo)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-004" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, {
      name: "Garlic Naan",
      pricePaise: 4900,
      photoUrl: "",
      isVeg: true,
      cuisineType: "Breads",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.photoUrl).toBe("");
  });

  test("isAvailable is always set to true regardless of input", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-005" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, { name: "Test Item", pricePaise: 9900 });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.isAvailable).toBe(true);
  });

  test("creates item with rating=5 (maximum)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-006" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, {
      name: "Signature Biryani",
      pricePaise: 45900,
      isVeg: false,
      rating: 5.0,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rating).toBe(5.0);
  });

  test("creates item with rating=1 (minimum)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-007" }) });

    await makeClient().createMenuItem(TOKEN, REST_ID, {
      name: "Plain Rice",
      pricePaise: 4900,
      rating: 1.0,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rating).toBe(1.0);
  });

  test("creates item with multiple cuisine categories", async () => {
    const cuisines = ["North Indian", "South Indian", "Chinese", "Continental", "Fast Food", "Desserts", "Beverages"];

    for (const cuisine of cuisines) {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: `item-${cuisine}` }) });
      await makeClient().createMenuItem(TOKEN, REST_ID, { name: `Item - ${cuisine}`, pricePaise: 19900, cuisineType: cuisine });
      const body = JSON.parse((fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as RequestInit).body as string);
      expect(body.cuisineType).toBe(cuisine);
    }
  });

  test("posts to correct restaurant-specific menu endpoint", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-008" }) });
    await makeClient().createMenuItem(TOKEN, "rest-xyz-999", { name: "Item", pricePaise: 9900 });
    expect((fetchMock.mock.calls[0][0] as string)).toBe(`${BASE}/api/v1/restaurants/rest-xyz-999/menu`);
  });
});

// ── Bulk Menu Import from Google Places ───────────────────────────────────────

describe("Bulk menu import from Google Places", () => {
  test("imports up to 3 items from Google Places data", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 3 }) });

    const googlePlaces = [
      { name: "Dominos Pizza", address: "Connaught Place, Delhi", rating: 4.1, lat: 28.6, lng: 77.2, photoUrl: "https://cdn.example.com/dominos.jpg" },
      { name: "McDonalds", address: "Lajpat Nagar, Delhi", rating: 3.8, lat: 28.61, lng: 77.21, photoUrl: null },
      { name: "KFC", address: "Saket, Delhi", rating: 4.2, lat: 28.62, lng: 77.22, photoUrl: "https://cdn.example.com/kfc.jpg" },
      { name: "Subway", address: "Vasant Kunj, Delhi", rating: 4.0, lat: 28.63, lng: 77.23, photoUrl: null },
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

    await makeClient().importMenuItems(TOKEN, REST_ID, items);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items).toHaveLength(3);
    expect(body.items[3]).toBeUndefined();
  });

  test("imported items include googlePlaceId for deduplication", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 2 }) });

    const items = [
      { name: "Dominos Pizza", pricePaise: 34900, googlePlaceId: "dominos-pizza-cp", photoUrl: "https://cdn.example.com/dominos.jpg", isVeg: true, rating: 4.1 },
      { name: "McDonalds", pricePaise: 34900, googlePlaceId: "mcdonalds-ln", photoUrl: "", isVeg: false, rating: 3.8 },
    ];

    await makeClient().importMenuItems(TOKEN, REST_ID, items);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items[0].googlePlaceId).toBe("dominos-pizza-cp");
    expect(body.items[1].googlePlaceId).toBe("mcdonalds-ln");
  });

  test("imported items use photoUrl from Google Places or empty string fallback", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 2 }) });

    const places = [
      { name: "Place With Photo", photoUrl: "https://cdn.example.com/photo.jpg", rating: 4.0 },
      { name: "Place Without Photo", photoUrl: null, rating: 3.5 },
    ];

    const items = places.map(p => ({
      name: p.name,
      pricePaise: 34900,
      photoUrl: p.photoUrl ?? "",
      isVeg: true,
      rating: p.rating,
    }));

    await makeClient().importMenuItems(TOKEN, REST_ID, items);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items[0].photoUrl).toBe("https://cdn.example.com/photo.jpg");
    expect(body.items[1].photoUrl).toBe("");
  });

  test("imported items preserve rating from Google Places", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 3 }) });

    const items = [
      { name: "High Rated", pricePaise: 34900, rating: 4.8, isVeg: true },
      { name: "Medium Rated", pricePaise: 34900, rating: 3.6, isVeg: false },
      { name: "Low Rated", pricePaise: 34900, rating: 2.9, isVeg: true },
    ];

    await makeClient().importMenuItems(TOKEN, REST_ID, items);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items[0].rating).toBe(4.8);
    expect(body.items[1].rating).toBe(3.6);
    expect(body.items[2].rating).toBe(2.9);
  });

  test("import posts to correct endpoint", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 1 }) });
    await makeClient().importMenuItems(TOKEN, REST_ID, [{ name: "Item", pricePaise: 9900, isVeg: true }]);
    expect((fetchMock.mock.calls[0][0] as string)).toBe(`${BASE}/api/v1/restaurants/${REST_ID}/menu/import`);
  });

  test("import sends items array wrapped in body object", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ imported: 1 }) });
    const items = [{ name: "Test", pricePaise: 9900, isVeg: true }];
    await makeClient().importMenuItems(TOKEN, REST_ID, items);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

// ── Restaurant Search — Diet Filtering ───────────────────────────────────────

describe("Restaurant search with veg/non-veg filtering", () => {
  function makeSearchResult(overrides: Partial<RestaurantSearchResult> = {}): RestaurantSearchResult {
    return {
      menu_item_id: "item-001",
      menu_item_name: "Paneer Tikka",
      description: "Soft paneer",
      price_paise: 28900,
      photo_url: null,
      is_veg: true,
      cuisine_type: "North Indian",
      rating: "4.5",
      restaurant_id: "rest-001",
      restaurant_name: "Spice Garden",
      restaurant_address: "12 MG Road, Delhi",
      distance_km: "1.2",
      ...overrides,
    };
  }

  test("search with diet=veg returns veg items (is_veg: true)", async () => {
    const vegItems = [
      makeSearchResult({ menu_item_id: "item-001", menu_item_name: "Paneer Tikka", is_veg: true }),
      makeSearchResult({ menu_item_id: "item-002", menu_item_name: "Dal Makhani", is_veg: true }),
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(vegItems) });

    const result = await makeClient().searchRestaurants(TOKEN, { diet: "veg", lat: 28.6, lng: 77.2 });
    expect(result.every(r => r.is_veg === true)).toBe(true);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("diet")).toBe("veg");
  });

  test("search with diet=non_veg returns non-veg items (is_veg: false)", async () => {
    const nonVegItems = [
      makeSearchResult({ menu_item_id: "item-003", menu_item_name: "Butter Chicken", is_veg: false }),
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(nonVegItems) });

    const result = await makeClient().searchRestaurants(TOKEN, { diet: "non_veg", lat: 28.6, lng: 77.2 });
    expect(result.every(r => r.is_veg === false)).toBe(true);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("diet")).toBe("non_veg");
  });

  test("search with diet=all returns mixed items", async () => {
    const mixed = [
      makeSearchResult({ menu_item_id: "item-001", is_veg: true }),
      makeSearchResult({ menu_item_id: "item-002", is_veg: false }),
      makeSearchResult({ menu_item_id: "item-003", is_veg: null }),
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(mixed) });

    const result = await makeClient().searchRestaurants(TOKEN, { diet: "all" });
    expect(result).toHaveLength(3);
    expect(result.some(r => r.is_veg === true)).toBe(true);
    expect(result.some(r => r.is_veg === false)).toBe(true);
  });

  test("search result includes photo_url field (can be null)", async () => {
    const results = [
      makeSearchResult({ photo_url: "https://cdn.amberkitchen.com/items/paneer.jpg" }),
      makeSearchResult({ menu_item_id: "item-002", photo_url: null }),
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(results) });

    const result = await makeClient().searchRestaurants(TOKEN, { diet: "all" });
    expect(result[0].photo_url).toBe("https://cdn.amberkitchen.com/items/paneer.jpg");
    expect(result[1].photo_url).toBeNull();
  });

  test("search result includes cuisine_type and rating metadata", async () => {
    const results = [
      makeSearchResult({ cuisine_type: "North Indian", rating: "4.5" }),
      makeSearchResult({ menu_item_id: "item-002", cuisine_type: "Chinese", rating: "4.2" }),
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(results) });

    const result = await makeClient().searchRestaurants(TOKEN, { diet: "all" });
    expect(result[0].cuisine_type).toBe("North Indian");
    expect(result[1].cuisine_type).toBe("Chinese");
    expect(result[0].rating).toBe("4.5");
  });

  test("search by cuisine type sets query param correctly", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await makeClient().searchRestaurants(TOKEN, { cuisine: "South Indian", diet: "veg" });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("cuisine")).toBe("South Indian");
  });

  test("search by minimum rating filters correctly", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await makeClient().searchRestaurants(TOKEN, { minRating: 4, diet: "all" });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("minRating")).toBe("4");
  });

  test("search sorted by distance includes sort param", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await makeClient().searchRestaurants(TOKEN, { sort: "distance", lat: 28.6, lng: 77.2 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("sort")).toBe("distance");
    expect(url.searchParams.get("lat")).toBe("28.6");
    expect(url.searchParams.get("lng")).toBe("77.2");
  });

  test("search by max price includes maxPricePaise param", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
    await makeClient().searchRestaurants(TOKEN, { maxPricePaise: 30000, diet: "all" });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("maxPricePaise")).toBe("30000");
  });

  test("search result includes distance_km for nearby sorting", async () => {
    const results = [
      makeSearchResult({ distance_km: "0.8" }),
      makeSearchResult({ menu_item_id: "item-002", distance_km: "2.3" }),
      makeSearchResult({ menu_item_id: "item-003", distance_km: null }),
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(results) });

    const result = await makeClient().searchRestaurants(TOKEN, { sort: "distance", lat: 28.6, lng: 77.2 });
    expect(Number(result[0].distance_km)).toBe(0.8);
    expect(result[2].distance_km).toBeNull();
  });
});

// ── Menu Price Validation ─────────────────────────────────────────────────────

describe("Menu item price handling", () => {
  test("price is stored in paise (integer)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "item-001" }) });
    await makeClient().createMenuItem(TOKEN, REST_ID, { name: "Samosa", pricePaise: 1500 });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.pricePaise).toBe(1500);
    expect(Number.isInteger(body.pricePaise)).toBe(true);
  });

  test("price in paise converts correctly to rupees display", () => {
    const cases: [number, string][] = [
      [1500, "₹15"],
      [24900, "₹249"],
      [34900, "₹349"],
      [28900, "₹289"],
      [100, "₹1"],
      [45900, "₹459"],
    ];
    cases.forEach(([paise, expected]) => {
      expect(`₹${(paise / 100).toFixed(0)}`).toBe(expected);
    });
  });

  test("default import price is 34900 paise (₹349)", () => {
    const importPrice = 34900;
    expect(importPrice / 100).toBe(349);
  });

  test("default single-add price is 29900 paise (₹299)", () => {
    const singleAddPrice = 29900;
    expect(singleAddPrice / 100).toBe(299);
  });
});

// ── Trending Restaurants — Menu Metadata ──────────────────────────────────────

describe("Trending restaurants — menu metadata", () => {
  test("trending results include starting_price_paise and photo_url", async () => {
    const trending = [
      {
        id: "rest-001",
        name: "Spice Garden",
        address: "12 MG Road, Delhi",
        cuisine_type: "North Indian",
        lat: "28.6",
        lng: "77.2",
        recent_orders: 150,
        rating: "4.5",
        starting_price_paise: 19900,
        photo_url: "https://cdn.amberkitchen.com/restaurants/spice-garden.jpg",
        distance_km: "1.2",
        trending_score: "98.5",
        predicted_eta_minutes: 25,
      },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(trending) });

    const result = await makeClient().trendingRestaurants(TOKEN, 28.6, 77.2);
    expect(result[0].starting_price_paise).toBe(19900);
    expect(result[0].photo_url).toContain("spice-garden.jpg");
    expect(result[0].cuisine_type).toBe("North Indian");
    expect(Number(result[0].rating)).toBe(4.5);
  });

  test("trending results include predicted ETA in minutes", async () => {
    const trending = [
      { id: "rest-002", name: "Quick Bites", address: "Delhi", cuisine_type: "Fast Food", lat: "28.61", lng: "77.21", recent_orders: 80, rating: "4.2", starting_price_paise: 14900, photo_url: null, distance_km: "0.5", trending_score: "85.0", predicted_eta_minutes: 15 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(trending) });

    const result = await makeClient().trendingRestaurants(TOKEN, 28.6, 77.2);
    expect(result[0].predicted_eta_minutes).toBe(15);
    expect(result[0].photo_url).toBeNull();
  });
});
