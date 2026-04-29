# AmberKitchen Flutter Mobile Demo

The Flutter app lives in `apps/flutter-mobile` and is designed for iPhone and Android.

## Feature Parity With Web
- OTP login, Google login, role selection, push registration, and test push
- Customer app: restaurant search, cuisine/diet/rating/distance/price filters, Google Places Delhi NCR, trending restaurants, ETA prediction, place/edit/cancel/refund/reorder, PhonePe, Paytm, Razorpay, live tracking map, ETA loop, reviews, support tickets, and route navigation
- Driver app: signup, Aadhaar URL capture, OCR verification hook, selfie face verification hook, background check, available orders, accept order, status updates, live location, wallet, earnings, payout request, and incentives
- Restaurant panel: onboarding, separate operations flow, menu add with photo URL, menu import with photos, order accept/reject, and earnings
- Admin dashboard: users, restaurants, approvals, all orders, payment reports, platform analytics, delivery admin live tracking, driver assignment, driver load balancing, best-driver assignment, AI demand prediction, analytics jobs, demand prediction history, zones, offers, campaigns, driver incentives, driver onboarding approval, referrals, payouts, Azure Blob/OCR/Face checks, audit logs, and verification logs

## Run Locally
Flutter SDK is required on the machine.

```bash
npm run flutter:pub-get
npm run flutter:ios
npm run flutter:android
```

Use iOS simulator with:

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:4000
```

Use Android emulator with:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

Use a real phone with the deployed Azure backend URL or your computer LAN IP.

## Demo Mode
Open the `Demo` tab and tap `Run complete mobile demo`. It displays every major feature area in one walkthrough without needing provider credentials. The Customer, Driver, Restaurant, and Admin tabs also contain live API action buttons for connected backend testing.

## Native Project Generation
If native folders are not present yet, run this inside `apps/flutter-mobile` after installing Flutter:

```bash
flutter create . --platforms=ios,android
```

Then add production app icons, signing, Google Maps keys, Firebase/APNs push credentials, and App Store/Play Store metadata.
