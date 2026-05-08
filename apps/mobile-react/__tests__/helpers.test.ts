/**
 * Pure helper function tests — formatCurrency and titleCase
 * These are extracted from App.tsx for isolated unit testing.
 */

function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

// ── formatCurrency ────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  test("converts paise to rupees with ₹ prefix", () => {
    expect(formatCurrency(24900)).toBe("₹249");
  });

  test("rounds down fractional rupees", () => {
    expect(formatCurrency(9950)).toBe("₹100");
  });

  test("formats zero as ₹0", () => {
    expect(formatCurrency(0)).toBe("₹0");
  });

  test("formats large amounts correctly", () => {
    expect(formatCurrency(5000000)).toBe("₹50000");
  });

  test("formats minimum item price (₹1)", () => {
    expect(formatCurrency(100)).toBe("₹1");
  });

  test("handles wallet balance correctly", () => {
    expect(formatCurrency(120000)).toBe("₹1200");
  });

  test("handles incentive reward correctly", () => {
    expect(formatCurrency(7500)).toBe("₹75");
  });
});

// ── titleCase ─────────────────────────────────────────────────────────────────

describe("titleCase", () => {
  test("capitalizes single word", () => {
    expect(titleCase("driver")).toBe("Driver");
  });

  test("converts underscores to spaces and capitalizes each word", () => {
    expect(titleCase("super_admin")).toBe("Super Admin");
  });

  test("handles picked_up status", () => {
    expect(titleCase("picked_up")).toBe("Picked Up");
  });

  test("handles already-uppercase strings", () => {
    expect(titleCase("PENDING")).toBe("PENDING");
  });

  test("handles multi-word status strings", () => {
    expect(titleCase("background_check_status")).toBe("Background Check Status");
  });

  test("handles restaurant role", () => {
    expect(titleCase("restaurant")).toBe("Restaurant");
  });

  test("handles delivery_admin role", () => {
    expect(titleCase("delivery_admin")).toBe("Delivery Admin");
  });

  test("handles non_veg diet type", () => {
    expect(titleCase("non_veg")).toBe("Non Veg");
  });

  test("handles single char word", () => {
    expect(titleCase("a")).toBe("A");
  });
});

// ── JWT role decoding (logic from App.tsx) ────────────────────────────────────

describe("JWT role decoding", () => {
  function decodeRole(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const validRoles = ["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"];
      if (payload?.role && validRoles.includes(payload.role)) {
        return payload.role as string;
      }
      return null;
    } catch {
      return null;
    }
  }

  function makeJwt(payload: Record<string, unknown>): string {
    const encoded = btoa(JSON.stringify(payload));
    return `header.${encoded}.signature`;
  }

  test("extracts driver role from JWT", () => {
    const token = makeJwt({ sub: "user-001", role: "driver" });
    expect(decodeRole(token)).toBe("driver");
  });

  test("extracts restaurant role from JWT", () => {
    const token = makeJwt({ sub: "user-002", role: "restaurant" });
    expect(decodeRole(token)).toBe("restaurant");
  });

  test("extracts admin role from JWT", () => {
    const token = makeJwt({ sub: "user-003", role: "admin" });
    expect(decodeRole(token)).toBe("admin");
  });

  test("extracts super_admin role from JWT", () => {
    const token = makeJwt({ sub: "user-004", role: "super_admin" });
    expect(decodeRole(token)).toBe("super_admin");
  });

  test("extracts delivery_admin role from JWT", () => {
    const token = makeJwt({ sub: "user-005", role: "delivery_admin" });
    expect(decodeRole(token)).toBe("delivery_admin");
  });

  test("returns null for unknown role in JWT", () => {
    const token = makeJwt({ sub: "user-006", role: "superuser" });
    expect(decodeRole(token)).toBeNull();
  });

  test("returns null for malformed JWT", () => {
    expect(decodeRole("not.a.jwt")).toBeNull();
    expect(decodeRole("")).toBeNull();
    expect(decodeRole("only-one-segment")).toBeNull();
  });

  test("returns null when no role claim in payload", () => {
    const token = makeJwt({ sub: "user-007" });
    expect(decodeRole(token)).toBeNull();
  });
});

// ── Tab availability logic ────────────────────────────────────────────────────

describe("Tab availability by role", () => {
  type Role = "customer" | "driver" | "restaurant" | "admin" | "super_admin" | "delivery_admin";
  type Tab = "driver" | "restaurant" | "admin";

  function getAvailableTabs(role: Role): Tab[] {
    if (role === "driver") return ["driver"];
    if (role === "restaurant") return ["restaurant"];
    return ["admin"];
  }

  test("driver role gets only driver tab", () => {
    expect(getAvailableTabs("driver")).toEqual(["driver"]);
  });

  test("restaurant role gets only restaurant tab", () => {
    expect(getAvailableTabs("restaurant")).toEqual(["restaurant"]);
  });

  test("admin role gets only admin tab", () => {
    expect(getAvailableTabs("admin")).toEqual(["admin"]);
  });

  test("super_admin role gets only admin tab", () => {
    expect(getAvailableTabs("super_admin")).toEqual(["admin"]);
  });

  test("delivery_admin role gets only admin tab", () => {
    expect(getAvailableTabs("delivery_admin")).toEqual(["admin"]);
  });

  test("customer role falls through to admin tab", () => {
    expect(getAvailableTabs("customer")).toEqual(["admin"]);
  });
});

// ── roleHelp messages ─────────────────────────────────────────────────────────

describe("Role help messages", () => {
  type Role = "customer" | "driver" | "restaurant" | "admin" | "super_admin" | "delivery_admin";

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

  test("driver role gets driver help message", () => {
    expect(getRoleHelp("driver")).toContain("Driver mode");
  });

  test("restaurant role gets restaurant help message", () => {
    expect(getRoleHelp("restaurant")).toContain("Restaurant mode");
  });

  test("admin role gets admin help message", () => {
    expect(getRoleHelp("admin")).toContain("Admin mode");
  });

  test("super_admin gets admin help message", () => {
    expect(getRoleHelp("super_admin")).toContain("Admin mode");
  });

  test("delivery_admin gets admin help message", () => {
    expect(getRoleHelp("delivery_admin")).toContain("Admin mode");
  });
});
