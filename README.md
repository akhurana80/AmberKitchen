# Cloud Kitchen System

## Architecture
- Microservices (auth, order, payment, dispatch, wallet, analytics)
- Frontend apps (customer, driver, admin, restaurant)

## Goals
- Scalable food delivery system
- Micro-zone optimization
- Real-time tracking

## Instructions for Codex
- Keep services independent
- Use TypeScript
- Maintain Docker compatibility
- Optimize performance and cost

## Added Platform Code
- Node.js TypeScript backend in `backend/`
- PostgreSQL schema in `database/schema.sql`
- OTP and Google authentication API routes
- Real OTP login through Azure Communication Services and Google Sign-In in the Angular UI
- Production OTP SMS delivery through Azure Communication Services
- PhonePe and Paytm payment adapter routes
- Razorpay payment adapter route alongside PhonePe and Paytm
- Live order tracking with Socket.IO
- Google Maps-ready live tracking panel in Angular
- Push notification plumbing through Firebase Cloud Messaging
- Angular web push registration with Firebase Cloud Messaging device tokens
- Angular UI in `apps/angular-ui/`
- Admin dashboard with platform metrics and recent orders
- Delivery partner app with available orders, order acceptance, status updates, and live location sharing
- Driver onboarding system with signup, Aadhaar upload or document URLs, OCR verification status, selfie face-match status, background check, Bank/UPI setup, referrals, and admin approval
- Place order, edit order before restaurant confirmation, rules-based cancellation, status history, and refund request handling
- Customer order lifecycle: place order, edit before confirmation, cancel by rules, live tracking, status updates, and refunds
- Auto-cancel for unaccepted restaurant orders, partial refunds, estimated delivery time, driver contact, and reorder support
- Role-based access control (RBAC) for customer, driver, restaurant, admin, super admin, and delivery admin roles
- Super Admin module for restaurant approvals, all orders, user management, Paytm/PhonePe reports, and analytics
- Restaurant approval system with pending, approved, and rejected states
- Restaurant Admin module for menu management, order accept/reject, and earnings
- Menu management with item photos, veg/non-veg flags, cuisine metadata, ratings, and bulk import
- Customer offers, restaurant ratings/reviews, and support ticket APIs
- Restaurant onboarding with business details, contact information, compliance IDs, bank reference, and Super Admin approval
- Separate restaurant panel login in `apps/restaurant-panel/` for restaurant onboarding and operations
- Google Places API integration for real Delhi NCR and Ghaziabad restaurants with rating filter, names, addresses, photos, and lat/lng
- Restaurant/menu search by keyword, cuisine, veg/non-veg, minimum rating, max price, distance, and price sorting
- Trending restaurant ranking with recent order demand, ratings, nearby distance, and delivery ETA predictions
- AI demand prediction jobs with zone/cuisine/hour forecasts and job history
- Zone management, SLA settings, campaign management, AI creative tracking, and driver incentives
- Driver load balancing with capacity scoring and best-driver assignment
- Wallet system with driver earnings, transaction history, payout requests, and admin payout processing
- Delivery Admin module for driver assignment and live order tracking
- Live tracking dashboard for delivery admins with last known driver coordinates and realtime order tracking
- Real Google Maps route navigation with pickup/dropoff routing, route drawing, and external navigation links
- ETA loop that records prediction events as live route estimates are refreshed
- Azure integration event tracking for WhatsApp, email, blob storage, OCR, face verification, Mapbox/OpenStreetMap routing, and missed-call OTP fallback
- Launch-readiness hardening: request IDs, CORS allow-list, in-memory rate limits, audit logs, DB-backed health checks, webhook signature verification, migration runner, CI workflow, Azure deploy workflow, backup script, and load-test script
- Azure Container Apps deployment script
- Versioned `/api/v1` routes while keeping existing `/api` compatibility
- Idempotent order creation to prevent duplicate orders during payment or network retries
- Payment webhook replay protection for Paytm, PhonePe, and Razorpay callback processing
- Migration folder, development seed data, smoke test, operations worker, Dockerfiles, OpenAPI contract, and launch/security runbooks
- React Native mobile app in `apps/mobile-react/` for iPhone and Android with customer, driver, restaurant, admin, live tracking, payments, wallet, push notification, and operations flows
- Flutter mobile app in `apps/flutter-mobile/` for iPhone and Android with matching web feature coverage and a full feature demo mode

## Local Run
1. Copy `backend/.env.example` to `backend/.env` and fill provider credentials.
2. Add your Google Maps browser key, Google web client ID, and Firebase web push config to `apps/angular-ui/src/environments/environment.ts`.
3. Add the same Firebase web config to `apps/angular-ui/src/firebase-messaging-sw.js`.
4. Start PostgreSQL and backend dependencies:
   ```bash
   docker compose -f infra/docker-compose.yml up --build
   ```
5. Apply database setup:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
6. Run the Angular UI:
   ```bash
   npm install
   npm run ui:start
   ```
7. Run launch-readiness checks:
   ```bash
   npm --workspace backend run build
   npm --workspace apps/angular-ui exec -- tsc -p tsconfig.app.json --noEmit
   npm run test:smoke
   npm run test:load
   npm run db:backup
   ```

## Launch Docs
- API contract: `docs/openapi.yaml`
- Launch runbook: `docs/launch-runbook.md`
- Security checklist: `docs/security-checklist.md`
- iOS/Android mobile app: `docs/mobile-app.md`
- Flutter iOS/Android demo: `docs/flutter-mobile-demo.md`
- Web/mobile/Flutter parity: `docs/app-feature-parity.md`

## Mobile App
```bash
npm install
npm run mobile:start
npm run mobile:ios
npm run mobile:android
```

Use `apps/mobile-react/.env.example` to configure the backend URL for simulator, emulator, real device, or Azure.

## Flutter Mobile App
```bash
npm run flutter:pub-get
npm run flutter:ios
npm run flutter:android
```

Flutter SDK is required locally. The Flutter app includes a Demo tab that walks through all customer, driver, restaurant, admin, analytics, wallet, payment, tracking, Azure, and marketplace features.

## App Parity Check
```bash
npm run check:app-parity
```
