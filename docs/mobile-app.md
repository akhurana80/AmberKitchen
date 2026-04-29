# AmberKitchen Mobile App

The mobile app lives in `apps/mobile-react` and uses Expo React Native so one React codebase can run on iPhone and Android.

## Covered Mobile Features
- OTP login and Google token login
- Push notification registration
- Restaurant search, cuisine filters, ratings, veg/non-veg, trending restaurants, and ETA predictions
- Place, edit, cancel, refund, reorder, and track orders
- PhonePe, Paytm, and Razorpay payment start flow
- Live order tracking with native map and Socket.IO updates
- Google Maps navigation handoff
- Delivery partner app: onboarding, Aadhaar/selfie URLs, background check, available orders, accept, status updates, live location, wallet, earnings, and payout request
- Restaurant panel: onboarding, menu item with photo URL, order accept/reject, and earnings
- Admin and delivery admin: dashboard, restaurant approvals, order/payment monitoring, live tracking, AI demand prediction, driver load balancing, and best-driver assignment

## Install
```bash
npm install
```

## Local API URL
Create `apps/mobile-react/.env` from `.env.example`.

For iOS simulator:
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_SOCKET_URL=http://localhost:4000
```

For Android emulator:
```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:4000
```

For a real phone, use your machine LAN IP or deployed Azure backend URL.

## Run
```bash
npm run mobile:start
npm run mobile:ios
npm run mobile:android
```

## Generate Native Projects
```bash
npm run mobile:prebuild
```

This creates native `ios/` and `android/` folders from the Expo config. Use EAS Build or local Xcode/Android Studio builds for store packages.

## Production Notes
- Replace placeholder Google Maps keys in `apps/mobile-react/app.json`.
- Configure Expo push notifications and Firebase/APNs credentials before production builds.
- Use Azure production API URLs through `EXPO_PUBLIC_API_BASE_URL`.
- Test payment callbacks on the deployed backend because mobile apps start payments, while provider webhooks complete them server-side.
