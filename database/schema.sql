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

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  name text not null,
  quantity integer not null,
  price_paise integer not null
);

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
  provider text not null check (provider in ('paytm', 'phonepe')),
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
  provider text not null check (provider in ('paytm', 'phonepe')),
  amount_paise integer not null,
  status refund_status not null default 'requested',
  reason text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists device_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
