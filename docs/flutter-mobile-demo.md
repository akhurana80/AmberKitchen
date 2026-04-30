# AmberKitchen Flutter Customer App

The Flutter app in `apps/flutter-mobile` is now the production customer app for iPhone and Android.

## Customer Features

- Customer-only OTP and Google Sign-In
- Secure persistent auth with `flutter_secure_storage`
- Proper customer screens: Home, Location selection, Restaurant listing, Restaurant details, Menu browsing, Cart, Checkout, Payment status, Order tracking, Order history, Profile, and Support
- Restaurant search with cuisine, veg/non-veg, rating, distance, and price sorting
- Trending restaurants and customer offers
- Persistent same-restaurant cart with quantity controls, item modifiers, coupon application, taxes/fees, delivery fee, address selection, and final checkout review
- Checkout from real backend menu data with backend-authoritative pricing
- Edit order before restaurant confirmation
- PhonePe, Paytm, and Razorpay payment method selection with deep-link return handling, pending/success/failure states, retry, and refund status display
- Live order tracking with Socket.IO plus ETA polling fallback
- Google Maps route display and external navigation
- Driver call button when assigned
- Cancel, refund, reorder, support, review, and push registration
- Offline, timeout, loading, and configuration error states

## Intentionally Not Exposed

This Flutter app does not expose admin, delivery partner, or restaurant tools. Those remain in the Angular web app and React Native all-role operations app.

## Run

```bash
cd apps/flutter-mobile
GOOGLE_MAPS_API_KEY=your-google-maps-key flutter run \
  --dart-define=API_BASE_URL=https://your-azure-backend.example.com \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=your-web-oauth-client-id
```

For Android emulator, use `http://10.0.2.2:4000` for a local backend. For iOS simulator, use `http://localhost:4000`.

## Store Readiness

The repo contains native iOS and Android Flutter scaffolds. Remaining manual release steps are provider and store setup: Android SDK/Play signing, full Xcode/CocoaPods/Apple signing, Firebase/APNs push credentials, Google OAuth clients, Google Maps keys, payment gateway production credentials on the Azure backend, and provider return URL registration for `amberkitchen://payment-callback`.
