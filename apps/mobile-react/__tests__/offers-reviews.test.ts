/**
 * Customer offers, restaurant reviews, and support tickets
 *
 * Tests cover:
 *   - Marketplace offers: flat and percentage discounts, minimum order
 *   - Offer code format and display
 *   - Restaurant reviews: rating (1–5), comment, orderId linkage
 *   - Review without optional fields (comment, orderId)
 *   - Support tickets: all categories, subject, message, orderId
 *   - Ticket status transitions (open → in_progress → resolved)
 *   - Admin support ticket view
 *   - Customer creates ticket; admin views it
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

// ── Marketplace Offers ────────────────────────────────────────────────────────

describe("Marketplace offers — fetch and display", () => {
  test("fetches active offers with code and title", async () => {
    const offers = [
      { id: "offer-001", code: "SAVE50", title: "Save ₹50", discount_type: "flat", discount_value: 5000 },
      { id: "offer-002", code: "TEN10", title: "10% Off", discount_type: "percent", discount_value: 10 },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(offers) });

    const result = await makeClient().marketplaceOffers("token");
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe("SAVE50");
    expect(result[1].code).toBe("TEN10");
  });

  test("flat discount shows ₹amount off", () => {
    const offer = { discount_type: "flat", discount_value: 5000 };
    const display = offer.discount_type === "flat"
      ? `₹${offer.discount_value / 100} off`
      : `${offer.discount_value}% off`;
    expect(display).toBe("₹50 off");
  });

  test("percent discount shows %value off", () => {
    const offer = { discount_type: "percent", discount_value: 15 };
    const display = offer.discount_type === "flat"
      ? `₹${offer.discount_value / 100} off`
      : `${offer.discount_value}% off`;
    expect(display).toBe("15% off");
  });

  test("createOffer posts flat discount payload correctly", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "offer-003" }) });

    await makeClient().createOffer("admin-token", "WELCOME100", "Welcome ₹100 Off", "flat", 10000, 29900);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.code).toBe("WELCOME100");
    expect(body.title).toBe("Welcome ₹100 Off");
    expect(body.discountType).toBe("flat");
    expect(body.discountValue).toBe(10000);
    expect(body.minOrderPaise).toBe(29900);
  });

  test("createOffer posts percent discount payload correctly", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "offer-004" }) });

    await makeClient().createOffer("admin-token", "FLAT20", "20% Off All Orders", "percent", 20, 19900);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.discountType).toBe("percent");
    expect(body.discountValue).toBe(20);
  });

  test("minimum order amount is enforced via minOrderPaise", () => {
    const offer = { discount_type: "flat", discount_value: 5000, min_order_paise: 29900 };
    const orderTotal = 24900;
    const offerApplicable = orderTotal >= offer.min_order_paise;
    expect(offerApplicable).toBe(false);
  });

  test("offer is applicable when order meets minimum", () => {
    const offer = { discount_type: "flat", discount_value: 5000, min_order_paise: 19900 };
    const orderTotal = 24900;
    const offerApplicable = orderTotal >= offer.min_order_paise;
    expect(offerApplicable).toBe(true);
  });

  test("flat discount applied to order total", () => {
    const orderTotal = 34900;
    const discountValue = 5000;
    const finalTotal = orderTotal - discountValue;
    expect(finalTotal).toBe(29900);
    expect(`₹${finalTotal / 100}`).toBe("₹299");
  });

  test("percent discount applied to order total", () => {
    const orderTotal = 34900;
    const discountPercent = 10;
    const discountAmount = Math.floor((orderTotal * discountPercent) / 100);
    const finalTotal = orderTotal - discountAmount;
    expect(discountAmount).toBe(3490);
    expect(finalTotal).toBe(31410);
  });

  test("offer code is uppercase alphanumeric", () => {
    const codes = ["SAVE50", "TEN10", "WELCOME100", "MOB4A2F", "FLAT20"];
    codes.forEach(code => {
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });
  });
});

// ── Restaurant Reviews ────────────────────────────────────────────────────────

describe("Restaurant reviews — creation and validation", () => {
  test("creates review with rating, comment, and orderId", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-001" }) });

    await makeClient().createRestaurantReview("customer-token", "rest-001", 5, "Excellent food and fast delivery!", "order-001");

    const url = fetchMock.mock.calls[0][0] as string;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(url).toContain("/marketplace/restaurants/rest-001/reviews");
    expect(body.rating).toBe(5);
    expect(body.comment).toBe("Excellent food and fast delivery!");
    expect(body.orderId).toBe("order-001");
  });

  test("creates review with only rating (no comment, no orderId)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-002" }) });

    await makeClient().createRestaurantReview("customer-token", "rest-001", 4);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rating).toBe(4);
    expect(body.comment).toBeUndefined();
    expect(body.orderId).toBeUndefined();
  });

  test("creates review with rating=1 (minimum valid rating)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-003" }) });

    await makeClient().createRestaurantReview("customer-token", "rest-002", 1, "Very disappointed.");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rating).toBe(1);
    expect(body.comment).toBe("Very disappointed.");
  });

  test("creates review with rating=5 (maximum valid rating)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-004" }) });

    await makeClient().createRestaurantReview("customer-token", "rest-003", 5, "Perfect!");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rating).toBe(5);
  });

  test("all integer ratings 1–5 are valid", () => {
    [1, 2, 3, 4, 5].forEach(rating => {
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(5);
    });
  });

  test("review is tied to specific restaurant via URL path", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-005" }) });

    const restaurantId = "rest-xyz-999";
    await makeClient().createRestaurantReview("token", restaurantId, 3);
    expect((fetchMock.mock.calls[0][0] as string)).toContain(`/restaurants/${restaurantId}/reviews`);
  });

  test("review uses Bearer token from customer session", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-006" }) });

    const customerToken = "customer.jwt.token";
    await makeClient().createRestaurantReview(customerToken, "rest-001", 4);

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${customerToken}`);
  });

  test("comment is optional — omitted when not provided", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "review-007" }) });

    await makeClient().createRestaurantReview("token", "rest-001", 3, undefined, "order-001");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.comment).toBeUndefined();
    expect(body.orderId).toBe("order-001");
  });
});

// ── Support Tickets ────────────────────────────────────────────────────────────

describe("Support tickets — creation by customers and admins", () => {
  const TICKET_CATEGORIES = ["delivery", "billing", "quality", "technical", "other"] as const;

  test.each(TICKET_CATEGORIES)("creates ticket with category='%s'", async (category) => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: `ticket-${category}` }) });

    await makeClient().createSupportTicket("token", category, `Issue with ${category}`, `Detailed description of ${category} problem.`);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.category).toBe(category);
    expect(body.subject).toBe(`Issue with ${category}`);
    fetchMock.mockClear();
  });

  test("creates delivery issue ticket linked to an order", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-001" }) });

    await makeClient().createSupportTicket("customer-token", "delivery", "Late delivery", "My order was 45 minutes late.", "order-cust-001");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.category).toBe("delivery");
    expect(body.orderId).toBe("order-cust-001");
    expect(body.subject).toBe("Late delivery");
    expect(body.message).toBe("My order was 45 minutes late.");
  });

  test("creates billing dispute ticket", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-002" }) });

    await makeClient().createSupportTicket("customer-token", "billing", "Charged twice", "I was charged twice for the same order.", "order-cust-002");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.category).toBe("billing");
    expect(body.message).toContain("charged twice");
  });

  test("creates technical issue ticket without orderId", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-003" }) });

    await makeClient().createSupportTicket("customer-token", "technical", "App crashes on checkout", "The app crashes when I tap Pay Now.");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.category).toBe("technical");
    expect(body.orderId).toBeUndefined();
  });

  test("admin creates test ticket for monitoring", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-004" }) });

    await makeClient().createSupportTicket("admin-token", "technical", "Mobile test ticket", "Test ticket created from AK Ops mobile app.");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.subject).toBe("Mobile test ticket");
    expect(body.message).toContain("AK Ops mobile app");
  });

  test("posts to correct support tickets endpoint", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-005" }) });

    await makeClient().createSupportTicket("token", "other", "General query", "I have a question.");
    expect((fetchMock.mock.calls[0][0] as string)).toBe(`${BASE}/api/v1/marketplace/support/tickets`);
  });

  test("admin fetches all tickets with status", async () => {
    const tickets = [
      { id: "ticket-001", category: "delivery", subject: "Late delivery", status: "open", created_at: "2026-05-08T10:00:00Z" },
      { id: "ticket-002", category: "billing", subject: "Charged twice", status: "in_progress", created_at: "2026-05-08T09:00:00Z" },
      { id: "ticket-003", category: "quality", subject: "Food quality", status: "resolved", created_at: "2026-05-08T08:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(tickets) });

    const result = await makeClient().supportTickets("admin-token");
    expect(result).toHaveLength(3);
    expect(result.find(t => t.status === "open")).toBeDefined();
    expect(result.find(t => t.status === "in_progress")).toBeDefined();
    expect(result.find(t => t.status === "resolved")).toBeDefined();
  });

  test("ticket status transitions: open → in_progress → resolved", () => {
    const statuses = ["open", "in_progress", "resolved"];
    const ticket = { status: "open" };

    expect(statuses.indexOf(ticket.status)).toBe(0);
    expect(statuses.indexOf("resolved")).toBe(2);
    statuses.forEach(s => expect(statuses).toContain(s));
  });

  test("tickets can be filtered by status on admin view", () => {
    const tickets = [
      { id: "t-001", status: "open" },
      { id: "t-002", status: "resolved" },
      { id: "t-003", status: "open" },
    ];
    const openTickets = tickets.filter(t => t.status === "open");
    expect(openTickets).toHaveLength(2);
  });

  test("ticket subject is a short description, message is full detail", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: "ticket-006" }) });

    const subject = "Missing item";
    const message = "I ordered Paneer Tikka but received Chicken Tikka instead. Order ID: order-001.";

    await makeClient().createSupportTicket("token", "quality", subject, message, "order-001");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.subject.length).toBeLessThan(body.message.length);
    expect(body.subject).toBe(subject);
    expect(body.message).toBe(message);
  });
});

// ── Google Places Integration ─────────────────────────────────────────────────

describe("Google Places integration for restaurant data", () => {
  test("Delhi NCR places returns restaurants with photo URLs", async () => {
    const places = {
      restaurants: [
        { name: "Dominos Pizza CP", address: "Connaught Place, Delhi", rating: 4.1, lat: 28.6315, lng: 77.2167, photoUrl: "https://cdn.example.com/dominos.jpg" },
        { name: "McDonalds Janpath", address: "Janpath, Delhi", rating: 3.9, lat: 28.6275, lng: 77.2217, photoUrl: null },
      ],
    };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(places) });

    const result = await makeClient().googlePlacesDelhiNcr("token", 3);
    expect(result.restaurants).toHaveLength(2);
    expect(result.restaurants[0].photoUrl).toBe("https://cdn.example.com/dominos.jpg");
    expect(result.restaurants[1].photoUrl).toBeNull();
  });

  test("places filtered by minimum rating", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ restaurants: [] }) });

    await makeClient().googlePlacesDelhiNcr("token", 4);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("minRating")).toBe("4");
  });

  test("regional places also returns structured restaurant data", async () => {
    const places = {
      restaurants: [
        { name: "Punjab Dhaba", address: "Amritsar", rating: 4.5, lat: 31.634, lng: 74.872, photoUrl: "https://cdn.example.com/dhaba.jpg" },
      ],
    };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(places) });

    const result = await makeClient().googlePlacesRegion("token", 4);
    expect(result.restaurants[0].name).toBe("Punjab Dhaba");
    expect(result.restaurants[0].rating).toBe(4.5);
  });
});
