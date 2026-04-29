create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('customer', 'driver', 'restaurant', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum ('created', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled');
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
  lat numeric(10, 7),
  lng numeric(10, 7),
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  name text not null,
  quantity integer not null,
  price_paise integer not null
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
