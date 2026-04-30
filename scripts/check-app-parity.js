const fs = require("fs");

const files = {
  web: "apps/angular-ui/src/services/api.service.ts",
  reactNative: "apps/mobile-react/src/api.ts",
  flutter: "apps/flutter-mobile/lib/api_client.dart",
  flutterUi: "apps/flutter-mobile/lib/main.dart"
};

const requiredStructure = [
  "backend/src/server.ts",
  "database/schema.sql",
  "apps/angular-ui/package.json",
  "apps/angular-ui/src/services/api.service.ts",
  "apps/mobile-react/package.json",
  "apps/mobile-react/App.tsx",
  "apps/mobile-react/src/api.ts",
  "apps/mobile-react/app.json",
  "apps/mobile-react/eas.json",
  "apps/flutter-mobile/pubspec.yaml",
  "apps/flutter-mobile/pubspec.lock",
  "apps/flutter-mobile/lib/main.dart",
  "apps/flutter-mobile/lib/api_client.dart",
  "apps/flutter-mobile/android/app/src/main/AndroidManifest.xml",
  "apps/flutter-mobile/ios/Runner/Info.plist",
  "docs/mobile-app.md",
  "docs/flutter-mobile-demo.md"
];

const customerFeatures = [
  ["OTP login", "requestOtp"],
  ["OTP verification", "verifyOtp"],
  ["Google login", "googleLogin"],
  ["Restaurant search and filters", "searchRestaurants"],
  ["Trending restaurants", "trendingRestaurants"],
  ["Offers", "marketplaceOffers"],
  ["Create order", "createOrder"],
  ["Order history", { web: null, reactNative: null, flutter: "orders" }],
  ["Get order", "getOrder"],
  ["Edit order before confirmation", { web: "editOrderBeforeConfirmation", reactNative: "editOrder", flutter: "editOrderBeforeConfirmation" }],
  ["Cancel order", "cancelOrder"],
  ["Reorder", "reorder"],
  ["Payments PhonePe/Paytm/Razorpay", "createPayment"],
  ["Refunds", "requestRefund"],
  ["Order ETA", "orderEta"],
  ["ETA loop", "orderEtaLoop"],
  ["Push registration", "registerDeviceToken"],
  ["Restaurant review", "createRestaurantReview"],
  ["Support ticket", "createSupportTicket"]
];

const fullOperationsFeatures = [
  ["Test push", "sendTestNotification"],
  ["Available delivery orders", "availableDeliveryOrders"],
  ["Accept delivery order", "acceptDeliveryOrder"],
  ["Update order status", "updateOrderStatus"],
  ["Driver live location", "sendDriverLocation"],
  ["Driver onboarding", "submitDriverOnboarding"],
  ["Driver onboarding mine", "myDriverOnboarding"],
  ["Driver background check", "runDriverBackgroundCheck"],
  ["Driver onboarding admin list", "driverOnboardingApplications"],
  ["Driver onboarding approval", "updateDriverApplicationApproval"],
  ["Driver referrals", "driverReferrals"],
  ["Admin dashboard", "adminDashboard"],
  ["Admin restaurants", "adminRestaurants"],
  ["Restaurant approval", "updateRestaurantApproval"],
  ["Admin users", "adminUsers"],
  ["Admin all orders", "adminAllOrders"],
  ["Payment reports", "paymentReports"],
  ["Platform analytics", "platformAnalytics"],
  ["AI demand prediction job", "runDemandPredictionJob"],
  ["Analytics jobs", "analyticsJobs"],
  ["Demand predictions", "demandPredictions"],
  ["Restaurant onboarding", "onboardRestaurant"],
  ["My restaurants", "myRestaurants"],
  ["Google Places Delhi NCR", { web: "googlePlacesDelhiNcrRestaurants", reactNative: "googlePlacesDelhiNcr" }],
  ["Menu item with photo", "createMenuItem"],
  ["Menu import with photos", "importMenuItems"],
  ["Restaurant orders", "restaurantOrders"],
  ["Restaurant order decision", "decideRestaurantOrder"],
  ["Restaurant earnings", "restaurantEarnings"],
  ["Delivery admin orders", "deliveryAdminOrders"],
  ["Delivery drivers", "deliveryDrivers"],
  ["Assign driver", "assignDriver"],
  ["Driver load balancing", "driverLoadBalancing"],
  ["Best-driver assignment", "assignBestDriver"],
  ["Wallet summary", "walletSummary"],
  ["Wallet transactions", "walletTransactions"],
  ["Driver earnings", "driverEarnings"],
  ["Payout request", "requestPayout"],
  ["Admin payouts", "adminPayouts"],
  ["Payout approval", "updatePayoutApproval"],
  ["Marketplace zones", "marketplaceZones"],
  ["Create zone", "createZone"],
  ["Create offer", "createOffer"],
  ["Support ticket admin list", "supportTickets"],
  ["Campaigns", "campaigns"],
  ["Create campaign", "createCampaign"],
  ["Create driver incentive", "createDriverIncentive"],
  ["Driver incentives", "driverIncentives"],
  ["Azure Blob asset", "createAzureBlobAsset"],
  ["Azure OCR", "verifyAzureOcr"],
  ["Azure Face", "verifyAzureFace"],
  ["Audit logs", "auditLogs"],
  ["Verification checks", "verificationChecks"]
];

const forbiddenFlutterMethods = [
  "adminDashboard",
  "availableDeliveryOrders",
  "submitDriverOnboarding",
  "onboardRestaurant",
  "deliveryAdminOrders",
  "requestPayout",
  "createAzureBlobAsset"
];

const forbiddenFlutterUiTerms = [
  "Admin Dashboard",
  "Delivery Partner App",
  "Restaurant Panel",
  "Driver Signup",
  "Onboard Restaurant",
  "Run Demo",
  "Full Feature Demo"
];

const forbiddenFlutterCodeTerms = [
  "00000000-0000-0000-0000-000000000001",
  "Flutter Demo",
  "placehold.co",
  "example.com/aadhaar",
  "example.com/selfie"
];

const requiredFlutterCustomerScreens = [
  "class HomeScreen",
  "class LocationSelectionScreen",
  "class RestaurantsScreen",
  "class RestaurantListingScreen",
  "class RestaurantDetailsScreen",
  "class MenuBrowsingScreen",
  "class CartScreen",
  "class CheckoutScreen",
  "class PaymentStatusScreen",
  "class OrderTrackingScreen",
  "class OrderHistoryScreen",
  "class ProfileScreen",
  "class SupportScreen"
];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function extractMethods(source, kind) {
  const pattern = kind === "flutter"
    ? /^\s+Future(?:<[^(\n]+>)?\s+([a-zA-Z0-9_]+)\(/gm
    : kind === "reactNative"
      ? /^  async ([a-zA-Z0-9_]+)\(/gm
      : /^  ([a-zA-Z0-9_]+)\(/gm;
  return new Set([...source.matchAll(pattern)].map(match => match[1]).filter(name => name !== "constructor" && !name.startsWith("_")));
}

function namesFor(method) {
  return typeof method === "string" ? { web: method, reactNative: method, flutter: method } : method;
}

const sources = {
  web: read(files.web),
  reactNative: read(files.reactNative),
  flutter: read(files.flutter),
  flutterUi: read(files.flutterUi)
};

const methods = {
  web: extractMethods(sources.web, "web"),
  reactNative: extractMethods(sources.reactNative, "reactNative"),
  flutter: extractMethods(sources.flutter, "flutter")
};

const missingStructure = requiredStructure.filter(path => !fs.existsSync(path));
const missingFeatures = [];
const flutterProductionIssues = [];

for (const [label, method] of customerFeatures) {
  const names = namesFor(method);
  for (const app of ["web", "reactNative", "flutter"]) {
    if (names[app] && !methods[app].has(names[app])) {
      missingFeatures.push(`${label}: ${app} missing ${names[app]}`);
    }
  }
}

for (const [label, method] of fullOperationsFeatures) {
  const names = namesFor(method);
  for (const app of ["web", "reactNative"]) {
    if (names[app] && !methods[app].has(names[app])) {
      missingFeatures.push(`${label}: ${app} missing ${names[app]}`);
    }
  }
}

for (const method of forbiddenFlutterMethods) {
  if (methods.flutter.has(method)) {
    flutterProductionIssues.push(`Flutter customer API should not expose ${method}`);
  }
}

for (const term of forbiddenFlutterUiTerms) {
  if (sources.flutterUi.includes(term)) {
    flutterProductionIssues.push(`Flutter customer UI exposes forbidden term: ${term}`);
  }
}

for (const term of forbiddenFlutterCodeTerms) {
  if (sources.flutter.includes(term) || sources.flutterUi.includes(term)) {
    flutterProductionIssues.push(`Flutter customer code contains hardcoded demo data: ${term}`);
  }
}

if (!sources.flutterUi.includes("FlutterSecureStorage")) {
  flutterProductionIssues.push("Flutter customer app is missing secure persistent auth storage");
}
if (!sources.flutterUi.includes("socket_io_client")) {
  flutterProductionIssues.push("Flutter customer app is missing Socket.IO live tracking client");
}
if (!sources.flutterUi.includes("API_BASE_URL") || !sources.flutterUi.includes("Production setup required")) {
  flutterProductionIssues.push("Flutter customer app must require production API configuration");
}

for (const screen of requiredFlutterCustomerScreens) {
  if (!sources.flutterUi.includes(screen)) {
    flutterProductionIssues.push(`Flutter customer app is missing ${screen}`);
  }
}

if (missingStructure.length || missingFeatures.length || flutterProductionIssues.length) {
  console.error(JSON.stringify({ missingStructure, missingFeatures, flutterProductionIssues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedCustomerFeatures: customerFeatures.length,
  checkedOperationsFeatures: fullOperationsFeatures.length,
  methods: {
    web: methods.web.size,
    reactNative: methods.reactNative.size,
    flutterCustomer: methods.flutter.size
  },
  apps: [
    "Angular web full platform",
    "React Native iOS/Android full platform",
    "Flutter iOS/Android customer-only production app"
  ]
}, null, 2));
