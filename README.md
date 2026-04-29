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
- Live order tracking with Socket.IO
- Google Maps-ready live tracking panel in Angular
- Push notification plumbing through Firebase Cloud Messaging
- Angular web push registration with Firebase Cloud Messaging device tokens
- Angular UI in `apps/angular-ui/`
- Admin dashboard with platform metrics and recent orders
- Delivery partner app with available orders, order acceptance, status updates, and live location sharing
- Place order, edit order before restaurant confirmation, rules-based cancellation, status history, and refund request handling
- Customer order lifecycle: place order, edit before confirmation, cancel by rules, live tracking, status updates, and refunds
- Auto-cancel for unaccepted restaurant orders, partial refunds, estimated delivery time, driver contact, and reorder support
- Role-based access control (RBAC) for customer, driver, restaurant, admin, super admin, and delivery admin roles
- Super Admin module for restaurant approvals, all orders, user management, Paytm/PhonePe reports, and analytics
- Restaurant approval system with pending, approved, and rejected states
- Restaurant Admin module for menu management, order accept/reject, and earnings
- Restaurant onboarding with business details, contact information, compliance IDs, bank reference, and Super Admin approval
- Separate restaurant panel login in `apps/restaurant-panel/` for restaurant onboarding and operations
- Delivery Admin module for driver assignment and live order tracking
- Live tracking dashboard for delivery admins with last known driver coordinates and realtime order tracking
- Azure Container Apps deployment script

## Local Run
1. Copy `backend/.env.example` to `backend/.env` and fill provider credentials.
2. Add your Google Maps browser key, Google web client ID, and Firebase web push config to `apps/angular-ui/src/environments/environment.ts`.
3. Add the same Firebase web config to `apps/angular-ui/src/firebase-messaging-sw.js`.
4. Start PostgreSQL and backend dependencies:
   ```bash
   docker compose -f infra/docker-compose.yml up --build
   ```
5. Run the Angular UI:
   ```bash
   npm install
   npm run ui:start
   ```
