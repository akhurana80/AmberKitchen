# AmberKitchen Launch Runbook

## Preflight
- Confirm all production secrets are configured in Azure App Configuration or Azure Container Apps secrets.
- Run `npm run db:migrate` against the production PostgreSQL database.
- Run `npm --workspace backend run build` and `npm --workspace apps/angular-ui run build`.
- Run `SMOKE_BASE_URL=https://<backend-host> npm run test:smoke` after deployment.
- Confirm `/health` returns `database: ok` and expected Azure configuration flags.

## Deployment Order
1. Deploy PostgreSQL, Redis-compatible cache if used, Azure Blob Storage, Application Insights, and Container Apps environment.
2. Deploy backend image from `backend/Dockerfile`.
3. Deploy worker image with command `npm --workspace backend run worker`.
4. Deploy Angular image from `apps/angular-ui/Dockerfile` or Azure Static Web Apps.
5. Validate payment webhooks, OTP SMS, Google login, push notification registration, and live tracking in staging before production traffic.

## Operations
- Use `npm run db:backup` from a secure runner with database access.
- Use Application Insights for request latency, error rate, worker failures, and payment callback errors.
- Alert on failed `/health`, payment webhook 5xx, worker silence, and high order auto-cancel rate.
- Keep provider webhook signing secrets rotated and never checked into Git.

## Rollback
- Roll back application containers to the previous image tag.
- Database migrations are forward-only by default. For launch-readiness tables, `database/migrations/002_launch_readiness.down.sql` is available for emergency rollback before production data depends on those tables.
