create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('customer', 'driver', 'restaurant', 'admin', 'super_admin', 'delivery_admin');
exception when duplicate_object then
  alter type user_role add value if not exists 'super_admin';
  alter type user_role add value if not exists 'delivery_admin';
end $$;

do $$ begin
  create type order_status as enum ('created', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type refund_status as enum ('requested', 'processing', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  phone text,
  email text,
  name text,
  google_id text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_identity_uidx on users ((coalesce(phone, '')), (coalesce(email, '')));
create unique index if not exists users_google_uidx on users (google_id) where google_id is not null;

create table if not exists otp_codes (
  id uuid primary key default uuid_generate_v4(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references users(id),
  name text not null,
  address text not null,
  contact_name text,
  contact_phone text,
  cuisine_type text,
  fssai_license text,
  gst_number text,
  bank_account_last4 text,
  onboarding_status text not null default 'draft' check (onboarding_status in ('draft', 'submitted', 'approved', 'rejected')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  lat numeric(10, 7),
  lng numeric(10, 7),
  created_at timestamptz not null default now()
);

alter table restaurants add column if not exists approval_status text not null default 'pending';
alter table restaurants add column if not exists contact_name text;
alter table restaurants add column if not exists contact_phone text;
alter table restaurants add column if not exists cuisine_type text;
alter table restaurants add column if not exists fssai_license text;
alter table restaurants add column if not exists gst_number text;
alter table restaurants add column if not exists bank_account_last4 text;
alter table restaurants add column if not exists onboarding_status text not null default 'draft';

create table if not exists menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  description text,
  price_paise integer not null,
  photo_url text,
  is_veg boolean,
  cuisine_type text,
  rating numeric(3, 2),
  google_place_id text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table menu_items add column if not exists photo_url text;
alter table menu_items add column if not exists is_veg boolean;
alter table menu_items add column if not exists cuisine_type text;
alter table menu_items add column if not exists rating numeric(3, 2);
alter table menu_items add column if not exists google_place_id text;

create index if not exists restaurants_approval_status_idx on restaurants (approval_status);
create index if not exists menu_items_restaurant_available_idx on menu_items (restaurant_id, is_available);
create index if not exists orders_restaurant_created_idx on orders (restaurant_id, created_at desc);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references users(id),
  restaurant_id uuid not null references restaurants(id),
  driver_id uuid references users(id),
  status order_status not null default 'created',
  total_paise integer not null,
  delivery_address text not null,
  delivery_lat numeric(10, 7) not null,
  delivery_lng numeric(10, 7) not null,
  cancellation_reason text,
  cancelled_by uuid references users(id),
  cancelled_at timestamptz,
  auto_cancel_at timestamptz,
  estimated_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders add column if not exists cancellation_reason text;
alter table orders add column if not exists cancelled_by uuid references users(id);
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists auto_cancel_at timestamptz;
alter table orders add column if not exists estimated_delivery_at timestamptz;
alter table orders add column if not exists subtotal_paise integer not null default 0;
alter table orders add column if not exists tax_paise integer not null default 0;
alter table orders add column if not exists platform_fee_paise integer not null default 0;
alter table orders add column if not exists delivery_fee_paise integer not null default 0;
alter table orders add column if not exists discount_paise integer not null default 0;
alter table orders add column if not exists coupon_code text;

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  name text not null,
  quantity integer not null,
  price_paise integer not null,
  modifiers jsonb not null default '[]'::jsonb
);

alter table order_items add column if not exists modifiers jsonb not null default '[]'::jsonb;

create table if not exists order_status_history (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references users(id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key,
  order_id uuid not null references orders(id),
  provider text not null check (provider in ('paytm', 'phonepe', 'razorpay')),
  amount_paise integer not null,
  status text not null,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refunds (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id),
  payment_id uuid references payments(id),
  provider text not null check (provider in ('paytm', 'phonepe', 'razorpay')),
  amount_paise integer not null,
  status refund_status not null default 'requested',
  reason text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table payments drop constraint if exists payments_provider_check;
  alter table payments add constraint payments_provider_check check (provider in ('paytm', 'phonepe', 'razorpay'));
  alter table refunds drop constraint if exists refunds_provider_check;
  alter table refunds add constraint refunds_provider_check check (provider in ('paytm', 'phonepe', 'razorpay'));
end $$;

create table if not exists driver_locations (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id),
  driver_id uuid not null references users(id),
  lat numeric(10, 7) not null,
  lng numeric(10, 7) not null,
  heading numeric(6, 2),
  speed numeric(6, 2),
  created_at timestamptz not null default now()
);

create table if not exists driver_onboarding (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references users(id) on delete cascade,
  full_name text not null,
  phone text,
  aadhaar_last4 text,
  aadhaar_front_url text,
  aadhaar_back_url text,
  selfie_url text,
  ocr_status text not null default 'pending' check (ocr_status in ('pending', 'verified', 'failed')),
  ocr_confidence numeric(5, 2),
  selfie_status text not null default 'pending' check (selfie_status in ('pending', 'verified', 'failed')),
  selfie_match_score numeric(5, 2),
  background_check_status text not null default 'pending' check (background_check_status in ('pending', 'clear', 'flagged')),
  bank_account_last4 text,
  upi_id text,
  referral_code text unique,
  referred_by_code text,
  approval_status text not null default 'pending' check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  admin_note text,
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table driver_onboarding add column if not exists aadhaar_last4 text;
alter table driver_onboarding add column if not exists aadhaar_front_url text;
alter table driver_onboarding add column if not exists aadhaar_back_url text;
alter table driver_onboarding add column if not exists selfie_url text;
alter table driver_onboarding add column if not exists ocr_status text not null default 'pending';
alter table driver_onboarding add column if not exists ocr_confidence numeric(5, 2);
alter table driver_onboarding add column if not exists selfie_status text not null default 'pending';
alter table driver_onboarding add column if not exists selfie_match_score numeric(5, 2);
alter table driver_onboarding add column if not exists background_check_status text not null default 'pending';
alter table driver_onboarding add column if not exists bank_account_last4 text;
alter table driver_onboarding add column if not exists upi_id text;
alter table driver_onboarding add column if not exists referral_code text unique;
alter table driver_onboarding add column if not exists referred_by_code text;
alter table driver_onboarding add column if not exists approval_status text not null default 'pending';
alter table driver_onboarding add column if not exists admin_note text;
alter table driver_onboarding add column if not exists approved_by uuid references users(id);
alter table driver_onboarding add column if not exists approved_at timestamptz;
alter table driver_onboarding add column if not exists updated_at timestamptz not null default now();

create table if not exists driver_referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_driver_id uuid references users(id),
  referred_driver_id uuid references users(id),
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'paid', 'rejected')),
  reward_paise integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists driver_onboarding_approval_idx on driver_onboarding (approval_status);
create index if not exists driver_referrals_code_idx on driver_referrals (referral_code);
create unique index if not exists driver_referrals_referred_uidx on driver_referrals (referred_driver_id) where referred_driver_id is not null;

create table if not exists wallet_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  balance_paise integer not null default 0,
  total_earnings_paise integer not null default 0,
  total_payouts_paise integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('earning', 'payout', 'refund', 'adjustment')),
  amount_paise integer not null,
  reference_type text,
  reference_id uuid,
  status text not null default 'posted' check (status in ('pending', 'posted', 'failed', 'reversed')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists driver_earnings (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references users(id),
  order_id uuid not null references orders(id),
  amount_paise integer not null,
  status text not null default 'earned' check (status in ('earned', 'paid', 'reversed')),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  amount_paise integer not null,
  method text not null check (method in ('upi', 'bank')),
  upi_id text,
  bank_account_last4 text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'processing', 'paid', 'rejected')),
  admin_note text,
  approved_by uuid references users(id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  summary jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists demand_predictions (
  id uuid primary key default uuid_generate_v4(),
  zone_key text not null,
  cuisine_type text,
  hour_start timestamptz not null,
  predicted_orders integer not null,
  confidence numeric(5, 2) not null,
  source_job_id uuid references analytics_jobs(id),
  created_at timestamptz not null default now()
);

create table if not exists eta_prediction_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  predicted_eta_minutes integer not null,
  distance_to_pickup_km numeric(8, 2),
  distance_to_dropoff_km numeric(8, 2),
  source text not null default 'eta-loop',
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx on wallet_transactions (user_id, created_at desc);
create index if not exists driver_earnings_driver_created_idx on driver_earnings (driver_id, created_at desc);
create index if not exists payouts_status_created_idx on payouts (status, created_at desc);
create index if not exists demand_predictions_hour_zone_idx on demand_predictions (hour_start desc, zone_key);
create index if not exists eta_prediction_events_order_created_idx on eta_prediction_events (order_id, created_at desc);

create table if not exists zones (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text not null,
  center_lat numeric(10, 7) not null,
  center_lng numeric(10, 7) not null,
  radius_km numeric(6, 2) not null default 3,
  sla_minutes integer not null default 25,
  surge_multiplier numeric(4, 2) not null default 1.00,
  created_at timestamptz not null default now()
);

create table if not exists restaurant_reviews (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  customer_id uuid not null references users(id),
  order_id uuid references orders(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists offers (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  title text not null,
  description text,
  discount_type text not null check (discount_type in ('flat', 'percent')),
  discount_value integer not null,
  min_order_paise integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists support_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  order_id uuid references orders(id),
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists driver_incentives (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid references users(id),
  title text not null,
  target_deliveries integer not null,
  reward_paise integer not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'earned', 'paid', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  zone_id uuid references zones(id),
  channel text not null check (channel in ('push', 'email', 'whatsapp', 'ads')),
  budget_paise integer not null default 0,
  ai_creative text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists integration_events (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  event_type text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists zones_city_idx on zones (city);
create index if not exists restaurant_reviews_restaurant_idx on restaurant_reviews (restaurant_id, created_at desc);
create index if not exists offers_active_idx on offers (is_active, starts_at, ends_at);
create index if not exists support_tickets_status_idx on support_tickets (status, created_at desc);
create index if not exists campaigns_status_idx on campaigns (status, created_at desc);
create index if not exists integration_events_provider_idx on integration_events (provider, created_at desc);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  request_id text,
  user_id uuid references users(id),
  method text not null,
  path text not null,
  status_code integer,
  ip text,
  user_agent text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists file_assets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references users(id),
  provider text not null default 'azure-blob',
  container_name text not null,
  blob_name text not null,
  content_type text,
  size_bytes integer,
  url text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists verification_checks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  check_type text not null check (check_type in ('azure-ocr', 'azure-face', 'background')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'manual_review')),
  confidence numeric(5, 2),
  provider text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  key text not null,
  user_id uuid not null references users(id),
  scope text not null,
  request_hash text,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (key, user_id, scope)
);

create table if not exists webhook_events (
  provider text not null,
  event_id text not null,
  transaction_id text,
  status text,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists file_assets_owner_idx on file_assets (owner_id, created_at desc);
create index if not exists verification_checks_user_idx on verification_checks (user_id, created_at desc);
create index if not exists idempotency_keys_user_created_idx on idempotency_keys (user_id, created_at desc);
create index if not exists webhook_events_received_idx on webhook_events (received_at desc);

create table if not exists device_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
