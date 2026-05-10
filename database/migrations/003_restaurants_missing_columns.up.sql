-- restaurants table was missing is_active, updated_at, rejection_reason
-- which caused 500 errors on offboard and approval endpoints
alter table restaurants add column if not exists rejection_reason text;
alter table restaurants add column if not exists is_active boolean not null default true;
alter table restaurants add column if not exists updated_at timestamptz not null default now();
