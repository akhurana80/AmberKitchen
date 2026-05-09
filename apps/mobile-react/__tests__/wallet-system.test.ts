import { ApiClient } from "../src/api";

const TOKEN = "driver-token-abc";
const ADMIN_TOKEN = "admin-token-xyz";

function makeClient() {
  return new ApiClient("http://localhost:4000");
}

const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});

// ── Wallet Summary ──────────────────────────────────────────────────────────

describe("walletSummary", () => {
  test("returns balance, total earnings, total payouts, and aggregates", async () => {
    const summary = {
      wallet: {
        balance_paise: 45000,
        total_earnings_paise: 120000,
        total_payouts_paise: 75000,
      },
      earnings: { earned_paise: "120000", deliveries: "48" },
      pendingPayouts: { requested_paise: "0", requests: "0" },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(summary),
    });
    const result = await makeClient().walletSummary(TOKEN);
    expect(result.wallet.balance_paise).toBe(45000);
    expect(result.wallet.total_earnings_paise).toBe(120000);
    expect(result.wallet.total_payouts_paise).toBe(75000);
    expect(result.earnings.deliveries).toBe("48");
    expect(result.pendingPayouts.requests).toBe("0");
  });

  test("balance equals total_earnings minus total_payouts", async () => {
    const summary = {
      wallet: {
        balance_paise: 30000,
        total_earnings_paise: 80000,
        total_payouts_paise: 50000,
      },
      earnings: { earned_paise: "80000", deliveries: "32" },
      pendingPayouts: { requested_paise: "10000", requests: "1" },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(summary),
    });
    const result = await makeClient().walletSummary(TOKEN);
    const computedBalance =
      result.wallet.total_earnings_paise - result.wallet.total_payouts_paise;
    expect(computedBalance).toBe(30000);
  });

  test("shows pending payout amount when request exists", async () => {
    const summary = {
      wallet: { balance_paise: 20000, total_earnings_paise: 60000, total_payouts_paise: 40000 },
      earnings: { earned_paise: "60000", deliveries: "24" },
      pendingPayouts: { requested_paise: "15000", requests: "1" },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(summary),
    });
    const result = await makeClient().walletSummary(TOKEN);
    expect(result.pendingPayouts.requested_paise).toBe("15000");
    expect(result.pendingPayouts.requests).toBe("1");
  });

  test("propagates 401 when token is invalid", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 401,
      text: async () => JSON.stringify({ error: "Unauthorized" }),
    });
    await expect(makeClient().walletSummary("bad-token")).rejects.toThrow();
  });
});

// ── Driver Earnings Per Delivery ───────────────────────────────────────────

describe("driverEarnings", () => {
  test("returns list of earnings with order_id and amount", async () => {
    const earnings = [
      { id: "earn-001", order_id: "ord-abc", amount_paise: 2500, status: "credited", created_at: "2026-05-09T09:00:00Z" },
      { id: "earn-002", order_id: "ord-def", amount_paise: 3000, status: "credited", created_at: "2026-05-09T10:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(earnings),
    });
    const result = await makeClient().driverEarnings(TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].order_id).toBe("ord-abc");
    expect(result[0].amount_paise).toBe(2500);
    expect(result[0].status).toBe("credited");
  });

  test("each earning entry has a timestamp", async () => {
    const earnings = [
      { id: "earn-003", order_id: "ord-ghi", amount_paise: 1800, status: "credited", created_at: "2026-05-09T11:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(earnings),
    });
    const result = await makeClient().driverEarnings(TOKEN);
    expect(result[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("returns empty array when driver has no earnings yet", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify([]),
    });
    const result = await makeClient().driverEarnings(TOKEN);
    expect(result).toEqual([]);
  });

  test("total earnings sum matches expected value", async () => {
    const earnings = [
      { id: "earn-004", order_id: "o1", amount_paise: 2500, status: "credited", created_at: "2026-05-09T08:00:00Z" },
      { id: "earn-005", order_id: "o2", amount_paise: 3200, status: "credited", created_at: "2026-05-09T09:30:00Z" },
      { id: "earn-006", order_id: "o3", amount_paise: 1800, status: "credited", created_at: "2026-05-09T11:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(earnings),
    });
    const result = await makeClient().driverEarnings(TOKEN);
    const total = result.reduce((sum, e) => sum + e.amount_paise, 0);
    expect(total).toBe(7500);
  });
});

// ── Wallet Transaction History ─────────────────────────────────────────────

describe("walletTransactions", () => {
  test("returns credit transactions from deliveries", async () => {
    const transactions = [
      { id: "txn-001", type: "credit", amount_paise: 2500, status: "settled", created_at: "2026-05-09T09:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(transactions),
    });
    const result = await makeClient().walletTransactions(TOKEN);
    expect(result[0].type).toBe("credit");
    expect(result[0].amount_paise).toBe(2500);
  });

  test("returns debit transactions from payouts", async () => {
    const transactions = [
      { id: "txn-002", type: "debit", amount_paise: 50000, status: "settled", created_at: "2026-05-08T15:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(transactions),
    });
    const result = await makeClient().walletTransactions(TOKEN);
    expect(result[0].type).toBe("debit");
    expect(result[0].amount_paise).toBe(50000);
  });

  test("returns mixed credit and debit transactions in order", async () => {
    const transactions = [
      { id: "txn-003", type: "credit", amount_paise: 3000, status: "settled", created_at: "2026-05-09T10:00:00Z" },
      { id: "txn-004", type: "debit", amount_paise: 25000, status: "settled", created_at: "2026-05-09T08:00:00Z" },
      { id: "txn-005", type: "credit", amount_paise: 2200, status: "settled", created_at: "2026-05-09T09:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(transactions),
    });
    const result = await makeClient().walletTransactions(TOKEN);
    expect(result).toHaveLength(3);
    const credits = result.filter((t) => t.type === "credit");
    const debits = result.filter((t) => t.type === "debit");
    expect(credits).toHaveLength(2);
    expect(debits).toHaveLength(1);
  });

  test("all transactions have a status field", async () => {
    const transactions = [
      { id: "txn-006", type: "credit", amount_paise: 1500, status: "pending", created_at: "2026-05-09T12:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(transactions),
    });
    const result = await makeClient().walletTransactions(TOKEN);
    expect(result[0].status).toBeDefined();
  });

  test("propagates server error on 500", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500,
      text: async () => JSON.stringify({ error: "Internal Server Error" }),
    });
    await expect(makeClient().walletTransactions(TOKEN)).rejects.toThrow();
  });
});

// ── Payout Requests ────────────────────────────────────────────────────────

describe("requestPayout via UPI", () => {
  test("submits payout request with UPI method and upiId", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 201,
      text: async () => JSON.stringify({ id: "pay-001", status: "pending" }),
    });
    const result = await makeClient().requestPayout(TOKEN, 50000, "upi", "driver@upi");
    expect(result).toMatchObject({ id: "pay-001", status: "pending" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.method).toBe("upi");
    expect(body.upiId).toBe("driver@upi");
    expect(body.amountPaise).toBe(50000);
  });

  test("submits payout request with bank method and bankAccountLast4", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 201,
      text: async () => JSON.stringify({ id: "pay-002", status: "pending" }),
    });
    const result = await makeClient().requestPayout(TOKEN, 100000, "bank", undefined, "1234");
    expect(result).toMatchObject({ id: "pay-002", status: "pending" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.method).toBe("bank");
    expect(body.bankAccountLast4).toBe("1234");
    expect(body.amountPaise).toBe(100000);
  });

  test("rejects payout when balance is insufficient (422)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 422,
      text: async () => JSON.stringify({ error: "Insufficient balance" }),
    });
    await expect(makeClient().requestPayout(TOKEN, 999999, "upi", "driver@upi")).rejects.toThrow();
  });

  test("rejects payout when a pending request already exists (409)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 409,
      text: async () => JSON.stringify({ error: "Pending payout already exists" }),
    });
    await expect(makeClient().requestPayout(TOKEN, 25000, "upi", "driver@upi")).rejects.toThrow();
  });
});

// ── Admin: List Payouts ────────────────────────────────────────────────────

describe("adminPayouts", () => {
  test("returns all pending payout requests across drivers", async () => {
    const payouts = [
      { id: "pay-010", amount_paise: 50000, method: "upi", status: "pending", phone: "+919999000001", role: "driver", created_at: "2026-05-09T08:00:00Z" },
      { id: "pay-011", amount_paise: 80000, method: "bank", status: "pending", phone: "+919999000002", role: "driver", created_at: "2026-05-09T09:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(payouts),
    });
    const result = await makeClient().adminPayouts(ADMIN_TOKEN);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending");
    expect(result[0].method).toBe("upi");
  });

  test("includes phone and role for each payout", async () => {
    const payouts = [
      { id: "pay-012", amount_paise: 30000, method: "upi", status: "approved", phone: "+919999000003", role: "driver", created_at: "2026-05-09T10:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(payouts),
    });
    const result = await makeClient().adminPayouts(ADMIN_TOKEN);
    expect(result[0].phone).toBe("+919999000003");
    expect(result[0].role).toBe("driver");
  });

  test("phone may be null for anonymous payouts", async () => {
    const payouts = [
      { id: "pay-013", amount_paise: 20000, method: "bank", status: "pending", phone: null, role: "driver", created_at: "2026-05-09T11:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(payouts),
    });
    const result = await makeClient().adminPayouts(ADMIN_TOKEN);
    expect(result[0].phone).toBeNull();
  });

  test("returns empty list when no payouts are queued", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify([]),
    });
    const result = await makeClient().adminPayouts(ADMIN_TOKEN);
    expect(result).toEqual([]);
  });
});

// ── Admin: Payout Approval State Machine ──────────────────────────────────

describe("updatePayoutApproval", () => {
  test("transitions pending → approved", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: "pay-020", status: "approved" }),
    });
    const result = await makeClient().updatePayoutApproval(ADMIN_TOKEN, "pay-020", "approved");
    expect(result).toMatchObject({ id: "pay-020", status: "approved" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.status).toBe("approved");
  });

  test("transitions approved → paid", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: "pay-020", status: "paid" }),
    });
    const result = await makeClient().updatePayoutApproval(ADMIN_TOKEN, "pay-020", "paid");
    expect(result).toMatchObject({ id: "pay-020", status: "paid" });
  });

  test("transitions pending → rejected with note", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: "pay-021", status: "rejected" }),
    });
    const result = await makeClient().updatePayoutApproval(ADMIN_TOKEN, "pay-021", "rejected", "Suspicious activity");
    expect(result).toMatchObject({ id: "pay-021", status: "rejected" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.note).toBe("Suspicious activity");
  });

  test("sends PATCH to correct payout ID endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify({ id: "pay-099", status: "approved" }),
    });
    await makeClient().updatePayoutApproval(ADMIN_TOKEN, "pay-099", "approved");
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain("/api/v1/wallet/payouts/pay-099/approval");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
  });

  test("rejects with 404 when payout ID does not exist", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 404,
      text: async () => JSON.stringify({ error: "Payout not found" }),
    });
    await expect(makeClient().updatePayoutApproval(ADMIN_TOKEN, "nonexistent", "approved")).rejects.toThrow();
  });

  test("rejects with 409 when transition is invalid (e.g. paid → approved)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 409,
      text: async () => JSON.stringify({ error: "Invalid status transition" }),
    });
    await expect(makeClient().updatePayoutApproval(ADMIN_TOKEN, "pay-022", "approved")).rejects.toThrow();
  });
});

// ── Wallet Balance Calculations ────────────────────────────────────────────

describe("wallet balance invariants", () => {
  test("net balance after multiple deliveries and one payout", async () => {
    // 3 deliveries at ₹25, ₹30, ₹18 = ₹73 total (7300 paise)
    // payout of ₹50 (5000 paise)
    // remaining balance = ₹23 (2300 paise)
    const summary = {
      wallet: {
        balance_paise: 2300,
        total_earnings_paise: 7300,
        total_payouts_paise: 5000,
      },
      earnings: { earned_paise: "7300", deliveries: "3" },
      pendingPayouts: { requested_paise: "0", requests: "0" },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(summary),
    });
    const result = await makeClient().walletSummary(TOKEN);
    expect(result.wallet.balance_paise).toBe(
      result.wallet.total_earnings_paise - result.wallet.total_payouts_paise
    );
  });

  test("paise to rupees conversion is correct (100 paise = 1 rupee)", () => {
    const amountPaise = 75000;
    const rupees = amountPaise / 100;
    expect(rupees).toBe(750);
  });

  test("zero balance when all earnings have been paid out", async () => {
    const summary = {
      wallet: {
        balance_paise: 0,
        total_earnings_paise: 50000,
        total_payouts_paise: 50000,
      },
      earnings: { earned_paise: "50000", deliveries: "20" },
      pendingPayouts: { requested_paise: "0", requests: "0" },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify(summary),
    });
    const result = await makeClient().walletSummary(TOKEN);
    expect(result.wallet.balance_paise).toBe(0);
  });
});

// ── Network Resilience ─────────────────────────────────────────────────────

describe("wallet API network resilience", () => {
  test("walletSummary rejects on network timeout (AbortError)", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    await expect(makeClient().walletSummary(TOKEN)).rejects.toThrow();
  });

  test("driverEarnings rejects on network timeout", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    await expect(makeClient().driverEarnings(TOKEN)).rejects.toThrow();
  });

  test("requestPayout rejects on network timeout", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    await expect(makeClient().requestPayout(TOKEN, 50000, "upi", "driver@upi")).rejects.toThrow();
  });
});
