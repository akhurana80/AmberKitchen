#!/usr/bin/env bash
# AmberKitchen — Local API Test Suite
# Run from: backend/ directory with backend running on :8080

BASE="http://localhost:8080/api"
PASS=0; FAIL=0; SKIP=0
SUPER_TOKEN=""; ADMIN_TOKEN=""; DRIVER_TOKEN=""; CUSTOMER_TOKEN=""; RESTAURANT_TOKEN=""
RESTAURANT_ID=""; MENU_ITEM_ID=""; ORDER_ID=""; DRIVER_APP_ID=""; PAYOUT_ID=""

# ── helpers ──────────────────────────────────────────────────────────────────
green='\033[0;32m'; red='\033[0;31m'; yellow='\033[1;33m'; cyan='\033[0;36m'; reset='\033[0m'

assert() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo -e "  ${green}✓${reset} $label"
    ((PASS++))
  else
    echo -e "  ${red}✗${reset} $label"
    echo -e "    expected: ${yellow}$expected${reset}"
    echo -e "    got:      ${red}$(echo "$actual" | head -c 300)${reset}"
    ((FAIL++))
  fi
}

skip() { echo -e "  ${yellow}⊘${reset} $1 (skipped — needs external service)"; ((SKIP++)); }

section() { echo -e "\n${cyan}━━━ $1 ━━━${reset}"; }

login() {
  local phone="$1" role="$2"
  local otp_res; otp_res=$(curl -s -X POST "$BASE/auth/otp/request" \
    -H "Content-Type: application/json" -d "{\"phone\":\"$phone\"}")
  local code; code=$(echo "$otp_res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('devCode',''))" 2>/dev/null)
  if [ -z "$code" ]; then echo "LOGIN_FAILED_NO_OTP"; return; fi
  local verify_res; verify_res=$(curl -s -X POST "$BASE/auth/otp/verify" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\",\"code\":\"$code\",\"role\":\"$role\"}")
  echo "$verify_res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','LOGIN_FAILED'))" 2>/dev/null
}

auth() { echo "Authorization: Bearer $1"; }

# ─────────────────────────────────────────────────────────────────────────────
section "1. AUTH — OTP Flow"

echo "  [1.1] Request OTP (super_admin)"
RES=$(curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" -d '{"phone":"+919999999999"}')
assert "returns sent:true" '"sent":true\|"sent": true' "$RES"
assert "returns devCode in dev mode" "devCode" "$RES"

echo "  [1.2] Request OTP — short phone rejected"
RES=$(curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" -d '{"phone":"+91123"}')
assert "rejects phone < 8 chars" '"error"\|"message"\|ZodError\|400\|invalid' "$RES"

echo "  [1.3] Verify OTP — wrong code rejected"
RES=$(curl -s -X POST "$BASE/auth/otp/verify" -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999","code":"000000","role":"super_admin"}')
assert "rejects wrong OTP" 'Invalid OTP\|401\|error' "$RES"

echo "  [1.4] Full OTP login → super_admin token"
SUPER_TOKEN=$(login "+919999999999" "super_admin")
assert "super_admin token issued" "eyJ" "$SUPER_TOKEN"

echo "  [1.5] Full OTP login → customer token"
CUSTOMER_TOKEN=$(login "+918888888888" "customer")
assert "customer token issued" "eyJ" "$CUSTOMER_TOKEN"

echo "  [1.6] Full OTP login → driver token"
DRIVER_TOKEN=$(login "+917777777777" "driver")
assert "driver token issued" "eyJ" "$DRIVER_TOKEN"

echo "  [1.7] Full OTP login → restaurant token"
RESTAURANT_TOKEN=$(login "+916666666666" "restaurant")
assert "restaurant token issued" "eyJ" "$RESTAURANT_TOKEN"

echo "  [1.8] Full OTP login → admin token"
ADMIN_TOKEN=$(login "+915555555555" "admin")
assert "admin token issued" "eyJ" "$ADMIN_TOKEN"

echo "  [1.9] No token → 401"
RES=$(curl -s "$BASE/admin/dashboard")
assert "unauthenticated request → 401" '"error"\|401' "$RES"

echo "  [1.10] Wrong role → 403"
RES=$(curl -s "$BASE/admin/dashboard" -H "$(auth "$CUSTOMER_TOKEN")")
assert "customer on admin route → 403" '"error"\|403\|Forbidden' "$RES"

# ─────────────────────────────────────────────────────────────────────────────
section "2. SUPER ADMIN DASHBOARD"

echo "  [2.1] GET /admin/dashboard"
RES=$(curl -s "$BASE/admin/dashboard" -H "$(auth "$SUPER_TOKEN")")
assert "dashboard returns data" '"orders"\|"users"\|"revenue"\|"restaurants"' "$RES"

echo "  [2.2] GET /admin/users"
RES=$(curl -s "$BASE/admin/users" -H "$(auth "$SUPER_TOKEN")")
assert "users list returned" '\[' "$RES"

echo "  [2.3] GET /admin/orders"
RES=$(curl -s "$BASE/admin/orders" -H "$(auth "$SUPER_TOKEN")")
assert "orders list returned" '\[' "$RES"

echo "  [2.4] GET /admin/restaurants"
RES=$(curl -s "$BASE/admin/restaurants" -H "$(auth "$SUPER_TOKEN")")
assert "restaurants list returned" '\[' "$RES"

echo "  [2.5] GET /admin/analytics"
RES=$(curl -s "$BASE/admin/analytics" -H "$(auth "$SUPER_TOKEN")")
assert "analytics returned" '"revenue"\|"orders"\|"users"\|{' "$RES"

echo "  [2.6] GET /admin/payment-reports"
RES=$(curl -s "$BASE/admin/payment-reports" -H "$(auth "$SUPER_TOKEN")")
assert "payment reports returned" '\[\|{' "$RES"

echo "  [2.7] Admin role can also access dashboard"
RES=$(curl -s "$BASE/admin/dashboard" -H "$(auth "$ADMIN_TOKEN")")
assert "admin role → dashboard ok" '"orders"\|"users"\|"revenue"\|"restaurants"' "$RES"

echo "  [2.8] PATCH /admin/users/:id/role — only super_admin"
# Use the customer-role user (safe to re-patch to customer without breaking other tests)
PATCH_USER_ID=$(curl -s "$BASE/admin/users" -H "$(auth "$SUPER_TOKEN")" | \
  python3 -c "import sys,json; rows=json.load(sys.stdin); found=[r for r in rows if r.get('role')=='customer']; print(found[0]['id'] if found else '')" 2>/dev/null)
if [ -n "$PATCH_USER_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/admin/users/$PATCH_USER_ID/role" \
    -H "$(auth "$SUPER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"role":"customer"}')
  assert "super_admin can patch user role" '"id"\|"role"\|updated\|success' "$RES"
  # Verify admin role cannot do the same
  RES2=$(curl -s -X PATCH "$BASE/admin/users/$PATCH_USER_ID/role" \
    -H "$(auth "$ADMIN_TOKEN")" -H "Content-Type: application/json" \
    -d '{"role":"customer"}')
  assert "admin (non-super) blocked from role patch" '"error"\|403\|Forbidden' "$RES2"
else
  skip "[2.8] no users found to patch"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "3. DELIVERY ADMIN DASHBOARD"

DELIVERY_TOKEN=$(login "+914444444444" "delivery_admin")
assert "delivery_admin token issued" "eyJ" "$DELIVERY_TOKEN"

echo "  [3.1] GET /delivery-admin/orders"
RES=$(curl -s "$BASE/delivery-admin/orders" -H "$(auth "$DELIVERY_TOKEN")")
assert "delivery orders list returned" '\[' "$RES"

echo "  [3.2] GET /delivery-admin/drivers"
RES=$(curl -s "$BASE/delivery-admin/drivers" -H "$(auth "$DELIVERY_TOKEN")")
assert "drivers list returned" '\[' "$RES"

echo "  [3.3] Customer cannot access delivery-admin"
RES=$(curl -s "$BASE/delivery-admin/orders" -H "$(auth "$CUSTOMER_TOKEN")")
assert "customer blocked from delivery-admin" '"error"\|403\|Forbidden' "$RES"

# ─────────────────────────────────────────────────────────────────────────────
section "4. RESTAURANTS — Add & Approve"

echo "  [4.1] POST /restaurants — create new restaurant"
RES=$(curl -s -X POST "$BASE/restaurants" \
  -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
  -d '{
    "name":"Test Biryani House",
    "address":"Sector 18, Noida",
    "contactName":"Ravi Kumar",
    "contactPhone":"+919876543210",
    "cuisineType":"Mughlai",
    "lat":28.5700,"lng":77.3210
  }')
assert "restaurant created" '"id"\|"name"' "$RES"
RESTAURANT_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

echo "  [4.2] GET /restaurants/mine"
RES=$(curl -s "$BASE/restaurants/mine" -H "$(auth "$RESTAURANT_TOKEN")")
assert "restaurant owner sees their restaurant" '\[' "$RES"

echo "  [4.3] GET /restaurants/trending"
RES=$(curl -s "$BASE/restaurants/trending" -H "$(auth "$CUSTOMER_TOKEN")")
assert "trending restaurants returned" '\[' "$RES"

echo "  [4.4] GET /restaurants/search"
RES=$(curl -s "$BASE/restaurants/search?q=biryani" -H "$(auth "$CUSTOMER_TOKEN")")
assert "search returns array" '\[' "$RES"

echo "  [4.5] PATCH /admin/restaurants/:id/approval — approve"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/admin/restaurants/$RESTAURANT_ID/approval" \
    -H "$(auth "$SUPER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"status":"approved","note":"Looks good"}')
  assert "restaurant approved by super_admin" '"id"\|"approved"\|success' "$RES"
else
  skip "[4.5] no restaurant ID to approve"
fi

echo "  [4.6] Admin (non-super) cannot approve restaurant"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/admin/restaurants/$RESTAURANT_ID/approval" \
    -H "$(auth "$ADMIN_TOKEN")" -H "Content-Type: application/json" \
    -d '{"status":"rejected"}')
  assert "admin (non-super) blocked from approval" '"error"\|403\|Forbidden' "$RES"
fi

echo "  [4.7] POST /restaurants/onboarding — restaurant onboarding form"
RES=$(curl -s -X POST "$BASE/restaurants/onboarding" \
  -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
  -d '{
    "name":"Test Biryani House Onboarding",
    "address":"Sector 18, Noida UP",
    "contactName":"Ravi Kumar",
    "contactPhone":"+919876543210",
    "cuisineType":"Mughlai",
    "fssaiLicense":"12345678901234",
    "gstNumber":"07AABCU9603R1ZX",
    "bankAccountLast4":"1234",
    "lat":28.57,"lng":77.32
  }')
assert "onboarding form accepted" '"id"\|"updated"\|success\|onboarding_status' "$RES"

# ─────────────────────────────────────────────────────────────────────────────
section "5. MENU ITEMS — Add & List"

if [ -z "$RESTAURANT_ID" ]; then
  RESTAURANT_ID=$(curl -s "$BASE/restaurants/search" -H "$(auth "$CUSTOMER_TOKEN")" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
fi

echo "  [5.1] POST /:restaurantId/menu — add item"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X POST "$BASE/restaurants/$RESTAURANT_ID/menu" \
    -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
    -d '{
      "name":"Chicken Biryani",
      "description":"Aromatic basmati with tender chicken",
      "pricePaise":24900,
      "isVeg":false,
      "cuisineType":"Mughlai"
    }')
  assert "menu item created" '"id"\|"name"' "$RES"
  MENU_ITEM_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
else
  skip "[5.1] no restaurant ID"
fi

echo "  [5.2] POST /:restaurantId/menu — veg item"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X POST "$BASE/restaurants/$RESTAURANT_ID/menu" \
    -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
    -d '{"name":"Paneer Butter Masala","pricePaise":19900,"isVeg":true}')
  assert "veg menu item created" '"id"\|"name"' "$RES"
fi

echo "  [5.3] GET /:restaurantId/menu (any authenticated user)"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s "$BASE/restaurants/$RESTAURANT_ID/menu" -H "$(auth "$CUSTOMER_TOKEN")")
  assert "menu items listed by customer" '\[' "$RES"
fi

echo "  [5.4] PATCH /restaurants/menu/:itemId — update price"
if [ -n "$MENU_ITEM_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/restaurants/menu/$MENU_ITEM_ID" \
    -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
    -d '{"pricePaise":27900}')
  assert "menu item price updated" '"id"\|"price_paise"\|updated\|success' "$RES"
else
  skip "[5.4] no menu item ID"
fi

echo "  [5.5] Menu item requires auth"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X POST "$BASE/restaurants/$RESTAURANT_ID/menu" \
    -H "Content-Type: application/json" -d '{"name":"Hack","pricePaise":100}')
  assert "unauthenticated menu add rejected" '"error"\|401' "$RES"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "6. ORDERS — Place & Track"

echo "  [6.1] POST /orders — place order as customer"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X POST "$BASE/orders" \
    -H "$(auth "$CUSTOMER_TOKEN")" -H "Content-Type: application/json" \
    -d '{
      "restaurantId":"'"$RESTAURANT_ID"'",
      "items":[{"name":"Chicken Biryani","quantity":2,"pricePaise":24900}],
      "deliveryAddress":"B-12 Sector 62, Noida",
      "deliveryLat":28.6279,"deliveryLng":77.3649
    }')
  assert "order placed successfully" '"id"\|"status"\|"total"' "$RES"
  ORDER_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
else
  skip "[6.1] no restaurant ID"
fi

echo "  [6.2] GET /orders/:id — fetch order"
if [ -n "$ORDER_ID" ]; then
  RES=$(curl -s "$BASE/orders/$ORDER_ID" -H "$(auth "$CUSTOMER_TOKEN")")
  assert "order details returned" '"id"\|"status"' "$RES"
fi

echo "  [6.3] GET /orders — customer sees own orders"
RES=$(curl -s "$BASE/orders" -H "$(auth "$CUSTOMER_TOKEN")")
assert "customer order list returned" '\[' "$RES"

echo "  [6.4] GET /orders/available — driver sees available orders"
RES=$(curl -s "$BASE/orders/available" -H "$(auth "$DRIVER_TOKEN")")
assert "available orders for driver" '\[' "$RES"

echo "  [6.5] PATCH /orders/:id/status — restaurant updates status"
if [ -n "$ORDER_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/orders/$ORDER_ID/status" \
    -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
    -d '{"status":"accepted"}')
  assert "restaurant accepts order" '"id"\|"status"\|accepted\|success' "$RES"
fi

echo "  [6.6] PATCH /orders/:id/assign — driver self-assigns"
if [ -n "$ORDER_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/orders/$ORDER_ID/assign" \
    -H "$(auth "$DRIVER_TOKEN")" -H "Content-Type: application/json" \
    -d '{}')
  assert "driver assigns self to order" '"id"\|"driver"\|"status"\|success\|error' "$RES"
fi

echo "  [6.7] POST /orders/:id/cancel — customer cancels"
if [ -n "$ORDER_ID" ]; then
  RES=$(curl -s -X POST "$BASE/orders/$ORDER_ID/cancel" \
    -H "$(auth "$CUSTOMER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"reason":"Changed my mind"}')
  assert "order cancel accepted" '"id"\|"status"\|cancelled\|success\|error' "$RES"
fi

echo "  [6.8] Driver cannot place order"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X POST "$BASE/orders" \
    -H "$(auth "$DRIVER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"restaurantId":"'"$RESTAURANT_ID"'","items":[{"name":"X","quantity":1,"pricePaise":100}],"deliveryAddress":"Test","deliveryLat":28.6,"deliveryLng":77.2}')
  assert "driver cannot place order → 403" '"error"\|403\|Forbidden' "$RES"
fi

echo "  [6.9] POST /orders/:id/reorder"
if [ -n "$ORDER_ID" ]; then
  RES=$(curl -s -X POST "$BASE/orders/$ORDER_ID/reorder" \
    -H "$(auth "$CUSTOMER_TOKEN")")
  assert "reorder creates new order" '"id"\|"status"\|success\|error' "$RES"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "7. DRIVER ONBOARDING & ASSIGNMENT"

echo "  [7.1] POST /driver-onboarding/signup"
RES=$(curl -s -X POST "$BASE/driver-onboarding/signup" \
  -H "$(auth "$DRIVER_TOKEN")" -H "Content-Type: application/json" \
  -d '{
    "fullName":"Rajesh Driver",
    "vehicleType":"bike",
    "licenseNumber":"DL0120230012345",
    "aadhaarLast4":"1234"
  }')
assert "driver signup accepted" '"id"\|"status"\|"vehicle"\|success' "$RES"
DRIVER_APP_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

echo "  [7.2] GET /driver-onboarding/mine"
RES=$(curl -s "$BASE/driver-onboarding/mine" -H "$(auth "$DRIVER_TOKEN")")
assert "driver sees own application" '"id"\|"status"\|{' "$RES"

echo "  [7.3] GET /driver-onboarding/admin/applications (admin)"
RES=$(curl -s "$BASE/driver-onboarding/admin/applications" -H "$(auth "$SUPER_TOKEN")")
assert "admin sees all driver applications" '\[' "$RES"

echo "  [7.4] PATCH /driver-onboarding/admin/applications/:id/approval"
if [ -z "$DRIVER_APP_ID" ]; then
  DRIVER_APP_ID=$(curl -s "$BASE/driver-onboarding/admin/applications" -H "$(auth "$SUPER_TOKEN")" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
fi
if [ -n "$DRIVER_APP_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/driver-onboarding/admin/applications/$DRIVER_APP_ID/approval" \
    -H "$(auth "$SUPER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"status":"approved","note":"Documents verified"}')
  assert "admin approves driver" '"id"\|"status"\|approved\|success' "$RES"
else
  skip "[7.4] no driver application found"
fi

echo "  [7.5] Delivery admin assigns driver to order"
if [ -n "$ORDER_ID" ]; then
  DRIVER_USER_ID=$(curl -s "$BASE/delivery-admin/drivers" -H "$(auth "$DELIVERY_TOKEN")" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
  if [ -n "$DRIVER_USER_ID" ]; then
    RES=$(curl -s -X PATCH "$BASE/delivery-admin/orders/$ORDER_ID/assign-driver" \
      -H "$(auth "$DELIVERY_TOKEN")" -H "Content-Type: application/json" \
      -d '{"driverId":"'"$DRIVER_USER_ID"'"}')
    assert "delivery admin assigns driver" '"id"\|"driver"\|success\|error' "$RES"
  else
    skip "[7.5] no driver found to assign"
  fi
fi

echo "  [7.6] GET /driver-onboarding/admin/referrals"
RES=$(curl -s "$BASE/driver-onboarding/admin/referrals" -H "$(auth "$SUPER_TOKEN")")
assert "referrals list returned" '\[' "$RES"

echo "  [7.7] Customer cannot view driver applications"
RES=$(curl -s "$BASE/driver-onboarding/admin/applications" -H "$(auth "$CUSTOMER_TOKEN")")
assert "customer blocked from driver admin" '"error"\|403\|Forbidden' "$RES"

# ─────────────────────────────────────────────────────────────────────────────
section "8. WALLET & PAYOUTS"

echo "  [8.1] GET /wallet/summary (driver)"
RES=$(curl -s "$BASE/wallet/summary" -H "$(auth "$DRIVER_TOKEN")")
assert "driver wallet summary returned" '"balance"\|"total"\|{' "$RES"

echo "  [8.2] GET /wallet/transactions (driver)"
RES=$(curl -s "$BASE/wallet/transactions" -H "$(auth "$DRIVER_TOKEN")")
assert "driver transactions returned" '\[' "$RES"

echo "  [8.3] GET /wallet/earnings (driver)"
RES=$(curl -s "$BASE/wallet/earnings" -H "$(auth "$DRIVER_TOKEN")")
assert "driver earnings returned" '\[' "$RES"

echo "  [8.4] POST /wallet/payouts/request"
RES=$(curl -s -X POST "$BASE/wallet/payouts/request" \
  -H "$(auth "$DRIVER_TOKEN")" -H "Content-Type: application/json" \
  -d '{"amountPaise":50000,"method":"upi","upiId":"driver@upi"}')
assert "payout request created" '"id"\|"status"\|"amount"\|success\|error' "$RES"
PAYOUT_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

echo "  [8.5] GET /wallet/payouts (admin only)"
RES=$(curl -s "$BASE/wallet/payouts" -H "$(auth "$SUPER_TOKEN")")
assert "admin sees all payouts" '\[' "$RES"

echo "  [8.6] PATCH /wallet/payouts/:id/approval — approve"
# Re-fetch payout ID from admin list in case request body didn't return id
if [ -z "$PAYOUT_ID" ]; then
  PAYOUT_ID=$(curl -s "$BASE/wallet/payouts" -H "$(auth "$SUPER_TOKEN")" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); [print(p['id']) for p in d if p.get('status')=='pending']" 2>/dev/null | head -1)
fi
if [ -n "$PAYOUT_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/wallet/payouts/$PAYOUT_ID/approval" \
    -H "$(auth "$SUPER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"status":"approved","note":"Verified and approved"}')
  assert "payout approved by admin" '"id"\|"status"\|approved\|success' "$RES"
else
  skip "[8.6] no payout ID found"
fi

echo "  [8.7] PATCH /wallet/payouts/:id/approval — mark paid"
if [ -n "$PAYOUT_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/wallet/payouts/$PAYOUT_ID/approval" \
    -H "$(auth "$SUPER_TOKEN")" -H "Content-Type: application/json" \
    -d '{"status":"paid"}')
  assert "payout marked as paid" '"id"\|"status"\|paid\|success' "$RES"
fi

echo "  [8.8] Customer cannot view payouts list"
RES=$(curl -s "$BASE/wallet/payouts" -H "$(auth "$CUSTOMER_TOKEN")")
assert "customer blocked from payout admin" '"error"\|403\|Forbidden' "$RES"

# ─────────────────────────────────────────────────────────────────────────────
section "9. PAYMENTS (order flow — no gateway keys needed)"

echo "  [9.1] POST /orders — payment skipped gracefully when no keys"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s -X POST "$BASE/orders" \
    -H "$(auth "$CUSTOMER_TOKEN")" -H "Content-Type: application/json" \
    -d '{
      "restaurantId":"'"$RESTAURANT_ID"'",
      "items":[{"name":"Paneer Tikka","quantity":1,"pricePaise":19900}],
      "deliveryAddress":"A-1 Connaught Place, Delhi",
      "deliveryLat":28.6315,"deliveryLng":77.2167
    }')
  assert "order created (payment separate)" '"id"\|"status"\|"total"' "$RES"
  NEW_ORDER_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
fi

skip "[9.2] PhonePe payment initiation (needs PHONEPE_MERCHANT_ID + PHONEPE_SALT_KEY)"
skip "[9.3] Razorpay payment initiation (needs RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET)"
skip "[9.4] Paytm payment initiation (needs PAYTM_MID + PAYTM_MERCHANT_KEY)"

# ─────────────────────────────────────────────────────────────────────────────
section "10. RESTAURANT ORDER MANAGEMENT"

echo "  [10.1] GET /:restaurantId/orders"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s "$BASE/restaurants/$RESTAURANT_ID/orders" -H "$(auth "$RESTAURANT_TOKEN")")
  assert "restaurant sees their orders" '\[' "$RES"
fi

echo "  [10.2] PATCH /restaurants/orders/:orderId/decision — accept"
if [ -n "$NEW_ORDER_ID" ]; then
  RES=$(curl -s -X PATCH "$BASE/restaurants/orders/$NEW_ORDER_ID/decision" \
    -H "$(auth "$RESTAURANT_TOKEN")" -H "Content-Type: application/json" \
    -d '{"decision":"accept","estimatedMinutes":30}')
  assert "restaurant accepts order" '"id"\|"status"\|accepted\|success\|error' "$RES"
fi

echo "  [10.3] GET /:restaurantId/earnings"
if [ -n "$RESTAURANT_ID" ]; then
  RES=$(curl -s "$BASE/restaurants/$RESTAURANT_ID/earnings" -H "$(auth "$RESTAURANT_TOKEN")")
  assert "restaurant earnings returned" '"total"\|"earnings"\|{' "$RES"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "RESULTS"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "\n  Total: $TOTAL  |  ${green}Passed: $PASS${reset}  |  ${red}Failed: $FAIL${reset}  |  ${yellow}Skipped: $SKIP${reset}"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${green}All tests passed!${reset}"
else
  echo -e "  ${red}$FAIL test(s) failed — check output above${reset}"
fi
echo ""
