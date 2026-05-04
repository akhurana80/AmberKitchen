# AmberKitchen Flutter Customer App

Production Flutter customer app for iOS, Android, and Web.

## Customer Scope

- OTP login with customer role only
- Google Sign-In using native mobile OAuth
- Persistent auth in secure storage
- Provider-backed customer state with a repository/service API layer
- Restaurant search with cuisine, veg/non-veg, rating, distance, and price filters
- Real cart with same-restaurant guardrails
- Checkout from real menu search results
- PhonePe, Paytm, and Razorpay payment handoff
- Live order tracking through Socket.IO plus ETA refresh fallback
- Google Maps route/navigation handoff
- Push notification registration
- Support, review, reorder, cancel, and refund customer flows

Admin, driver, and restaurant tools are intentionally not exposed in this app.

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Authentication with Google provider
3. Enable Cloud Messaging for push notifications
4. Add Android app with package name `com.amberkitchen.customer`
5. Add iOS app with bundle ID `com.amberkitchen.customer`
6. Add Web app for Chrome support
7. Download and place config files:
   - `android/app/google-services.json`
   - `ios/Runner/GoogleService-Info.plist`
   - `web/firebase-config.js` (create this file with web config)
8. Configure Firebase Cloud Messaging in the Firebase console

## Running on Chrome

To run the app in Chrome for development:

```bash
flutter run -d chrome --dart-define=PRODUCTION=false
```

For production build:

```bash
flutter build web --dart-define=PRODUCTION=true
```

## Required Build Values

The app intentionally does not default to localhost or demo data. Provide these values for every live build:

### Local Development (Chrome)
```bash
API_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-local-web-google-client-id
GOOGLE_SERVER_CLIENT_ID=your-local-google-server-client-id
SERVICE_REGION_NAME=Delhi NCR
SERVICE_REGION_LAT=28.6139
SERVICE_REGION_LNG=77.2090
```

### Production
```bash
API_BASE_URL=https://api.amberkitchen.com
GOOGLE_CLIENT_ID=your-production-web-google-client-id
GOOGLE_SERVER_CLIENT_ID=your-production-google-server-client-id
SERVICE_REGION_NAME=Delhi NCR
SERVICE_REGION_LAT=28.6139
SERVICE_REGION_LNG=77.2090
```

For mobile builds, additional platform-specific values may be required.
FIREBASE_MESSAGING_SENDER_ID=your-firebase-sender-id
```

## Run Locally

```bash
GOOGLE_MAPS_API_KEY=your-google-maps-key flutter run \
  --dart-define=API_BASE_URL=http://localhost:4000 \
  --dart-define=SERVICE_REGION_NAME="Ghaziabad" \
  --dart-define=SERVICE_REGION_LAT=28.6692 \
  --dart-define=SERVICE_REGION_LNG=77.4538 \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=your-web-oauth-client-id
```

For Android emulator:

```bash
GOOGLE_MAPS_API_KEY=your-google-maps-key flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000 \
  --dart-define=SERVICE_REGION_NAME="Ghaziabad" \
  --dart-define=SERVICE_REGION_LAT=28.6692 \
  --dart-define=SERVICE_REGION_LNG=77.4538 \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=your-web-oauth-client-id
```

## Store Build Notes

- Android needs Android SDK and Play signing configured locally or in CI.
- iOS needs full Xcode, CocoaPods, Apple Developer membership, bundle ID, signing team, and App Store Connect setup.
- Firebase/APNs must be configured before push notifications can work on devices.
- Payment gateway credentials and webhooks remain server-side in the Azure backend.
