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
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders add column if not exists cancellation_reason text;
alter table orders add column if not exists cancelled_by uuid references users(id);
alter table orders add column if not exists cancelled_at timestamptz;

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

create table if not exists device_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
