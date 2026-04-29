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
- Production OTP SMS delivery through Azure Communication Services
- PhonePe and Paytm payment adapter routes
- Live order tracking with Socket.IO
- Google Maps-ready live tracking panel in Angular
- Push notification plumbing through Firebase Cloud Messaging
- Angular UI in `apps/angular-ui/`
- Admin dashboard with platform metrics and recent orders
- Delivery partner app with available orders, order acceptance, status updates, and live location sharing
- Azure Container Apps deployment script

## Local Run
1. Copy `backend/.env.example` to `backend/.env` and fill provider credentials.
2. Add your Google Maps browser key to `apps/angular-ui/src/environments/environment.ts`.
3. Start PostgreSQL and backend dependencies:
   ```bash
   docker compose -f infra/docker-compose.yml up --build
   ```
4. Run the Angular UI:
   ```bash
   npm install
   npm run ui:start
   ```
