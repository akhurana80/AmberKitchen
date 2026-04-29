# App Feature Parity

AmberKitchen has three user-facing clients:

- Angular web app: `apps/angular-ui`
- React Native iOS/Android app: `apps/mobile-react`
- Flutter iOS/Android app: `apps/flutter-mobile`

All three clients are wired to the same backend feature set.

## Verified Feature Groups

- Authentication: OTP, Google login, role selection
- Notifications: push registration and test push
- Customer ordering: place, edit before confirmation, cancel, refund, reorder, status history
- Restaurant discovery: Google Places Delhi NCR, search, cuisine, veg/non-veg, rating, distance, price sorting
- Marketplace: trending restaurants, offers, reviews, support tickets
- Payments: PhonePe, Paytm, Razorpay
- Tracking: live location, ETA prediction, ETA loop, route navigation
- Driver app: onboarding, Aadhaar URLs, OCR, selfie face check, background check, referrals, available orders, accept orders, status updates, location sharing
- Restaurant panel: onboarding, separate panel flow, menu add, menu photo, menu import, order decision, earnings
- Admin dashboard: users, restaurants, approvals, all orders, payment reports, analytics
- Delivery admin: live orders, drivers, driver assignment
- Operations: AI demand prediction, analytics jobs, demand history, driver load balancing, best-driver assignment
- Wallet: balances, transactions, earnings, payout request, payout approval
- Growth and zones: zones, offers, campaigns, driver incentives

## Automated Check

Run:

```bash
npm run check:app-parity
```

The checker validates expected app structure and confirms each feature API method is present across Angular web, React Native, and Flutter.

## Native Folders

The React Native app uses Expo and can generate native projects with:

```bash
npm run mobile:prebuild
```

The Flutter app source is present. Flutter SDK is required to generate native folders:

```bash
cd apps/flutter-mobile
flutter create . --platforms=ios,android
```

Those generated native folders are intentionally not hand-written because they should come from the installed Flutter SDK and local signing configuration.
