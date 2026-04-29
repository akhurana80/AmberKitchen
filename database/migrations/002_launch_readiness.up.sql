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

create index if not exists idempotency_keys_user_created_idx on idempotency_keys (user_id, created_at desc);
create index if not exists webhook_events_received_idx on webhook_events (received_at desc);
