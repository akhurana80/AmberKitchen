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
- PhonePe and Paytm payment adapter routes
- Live order tracking with Socket.IO
- Push notification plumbing through Firebase Cloud Messaging
- Angular UI in `apps/angular-ui/`
- AWS ECS and Azure Container Apps deployment scripts

## Local Run
1. Copy `backend/.env.example` to `backend/.env` and fill provider credentials.
2. Start PostgreSQL and backend dependencies:
   ```bash
   docker compose -f infra/docker-compose.yml up --build
   ```
3. Run the Angular UI:
   ```bash
   npm install
   npm run ui:start
   ```
