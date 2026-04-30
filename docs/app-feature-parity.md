# App Feature Parity

AmberKitchen has three user-facing clients:

- Angular web app: `apps/angular-ui` for browser and platform operations
- React Native iOS/Android app: `apps/mobile-react` for all-role mobile operations
- Flutter iOS/Android app: `apps/flutter-mobile` for production customer ordering

Angular and React Native cover the full platform surface. Flutter is intentionally customer-only for a clean launch app and does not expose admin, driver, or restaurant tools.

## Verified Feature Groups

- Authentication: OTP and Google login
- Notifications: push registration
- Customer ordering: place, edit before confirmation, cancel, refund, reorder, status history
- Restaurant discovery: search, cuisine, veg/non-veg, rating, distance, price sorting
- Marketplace: trending restaurants, offers, reviews, support tickets
- Payments: PhonePe, Paytm, Razorpay
- Tracking: live location, ETA prediction, ETA loop, route navigation
- Angular and React Native operations: driver onboarding, restaurant panel, admin dashboard, delivery admin, wallet, payouts, analytics, campaigns, Azure Blob/OCR/Face checks, audit logs, and verification monitoring

## Automated Check

Run:

```bash
npm run check:app-parity
```

The checker validates expected app structure, confirms customer API coverage across all three clients, confirms full operations APIs across Angular and React Native, and verifies the Flutter app stays customer-only with no hardcoded demo data.

## Native Folders

The React Native app uses Expo and can generate native projects with:

```bash
npm run mobile:prebuild
```

The Flutter app has generated native `ios/` and `android/` folders. Store signing, OAuth clients, Firebase/APNs credentials, and app store subscriptions remain manual provider steps.
