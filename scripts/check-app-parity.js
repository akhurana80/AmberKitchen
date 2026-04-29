const fs = require("fs");

const files = {
  web: "apps/angular-ui/src/services/api.service.ts",
  reactNative: "apps/mobile-react/src/api.ts",
  flutter: "apps/flutter-mobile/lib/api_client.dart"
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
  "apps/flutter-mobile/lib/main.dart",
  "apps/flutter-mobile/lib/api_client.dart",
  "docs/mobile-app.md",
  "docs/flutter-mobile-demo.md"
];

const features = [
  ["OTP login", "requestOtp"],
  ["OTP verification", "verifyOtp"],
  ["Google login", "googleLogin"],
  ["Create order", "createOrder"],
  ["Get order", "getOrder"],
  ["Edit order before confirmation", { web: "editOrderBeforeConfirmation", reactNative: "editOrder", flutter: "editOrderBeforeConfirmation" }],
  ["Cancel order", "cancelOrder"],
  ["Reorder", "reorder"],
  ["Payments PhonePe/Paytm/Razorpay", "createPayment"],
  ["Refunds", "requestRefund"],
  ["Push registration", "registerDeviceToken"],
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
  ["Order ETA", "orderEta"],
  ["ETA loop", "orderEtaLoop"],
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
  ["Google Places Delhi NCR", { web: "googlePlacesDelhiNcrRestaurants", reactNative: "googlePlacesDelhiNcr", flutter: "googlePlacesDelhiNcrRestaurants" }],
  ["Trending restaurants", "trendingRestaurants"],
  ["Restaurant search and filters", "searchRestaurants"],
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
  ["Offers", "marketplaceOffers"],
  ["Create offer", "createOffer"],
  ["Restaurant review", "createRestaurantReview"],
  ["Support ticket", "createSupportTicket"],
  ["Campaigns", "campaigns"],
  ["Create campaign", "createCampaign"],
  ["Create driver incentive", "createDriverIncentive"],
  ["Driver incentives", "driverIncentives"]
];

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function extractMethods(source, kind) {
  const pattern = kind === "flutter"
    ? /^  Future<dynamic> ([a-zA-Z0-9_]+)\(/gm
    : kind === "reactNative"
      ? /^  async ([a-zA-Z0-9_]+)\(/gm
      : /^  ([a-zA-Z0-9_]+)\(/gm;
  return new Set([...source.matchAll(pattern)].map(match => match[1]).filter(name => name !== "constructor" && !name.startsWith("_")));
}

const methods = {
  web: extractMethods(read(files.web), "web"),
  reactNative: extractMethods(read(files.reactNative), "reactNative"),
  flutter: extractMethods(read(files.flutter), "flutter")
};

const missingStructure = requiredStructure.filter(path => !fs.existsSync(path));
const missingFeatures = [];

for (const [label, method] of features) {
  const names = typeof method === "string"
    ? { web: method, reactNative: method, flutter: method }
    : method;

  for (const app of ["web", "reactNative", "flutter"]) {
    if (!methods[app].has(names[app])) {
      missingFeatures.push(`${label}: ${app} missing ${names[app]}`);
    }
  }
}

if (missingStructure.length || missingFeatures.length) {
  console.error(JSON.stringify({ missingStructure, missingFeatures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedFeatures: features.length,
  methods: {
    web: methods.web.size,
    reactNative: methods.reactNative.size,
    flutter: methods.flutter.size
  },
  apps: ["Angular web", "React Native iOS/Android", "Flutter iOS/Android"]
}, null, 2));
