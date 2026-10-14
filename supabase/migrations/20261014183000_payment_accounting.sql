create type payment_status as enum ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED');
create type payout_status as enum ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

create table public.reward_pools (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null unique references public.quests(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  settlement_asset text not null,
  funded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  reward_pool_id uuid not null references public.reward_pools(id),
  creator_id uuid not null references public.users(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  settlement_asset text not null,
  network text not null,
  status payment_status not null default 'CREATED',
  idempotency_key text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id),
  provider_reference text not null unique,
  transaction_hash text,
  amount_minor bigint not null check (amount_minor > 0),
  settlement_asset text not null,
  network text not null,
  confirmations integer not null default 0 check (confirmations >= 0),
  verified_at timestamptz,
  raw_receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reward_allocations (
  id uuid primary key default gen_random_uuid(),
  reward_pool_id uuid not null references public.reward_pools(id),
  winner_id uuid not null references public.quest_winners(id),
  recipient_id uuid not null references public.users(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  created_at timestamptz not null default now(),
  unique (reward_pool_id, winner_id)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  reward_allocation_id uuid not null unique references public.reward_allocations(id),
  recipient_id uuid not null references public.users(id),
  amount_minor bigint not null check (amount_minor > 0),
  settlement_asset text not null,
  network text not null,
  destination_address text not null,
  status payout_status not null default 'PENDING',
  idempotency_key text not null unique,
  provider_reference text unique,
  transaction_hash text unique,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_intents_creator_idx on public.payment_intents (creator_id, created_at desc);
create index payouts_recipient_idx on public.payouts (recipient_id, created_at desc);

alter table public.reward_pools enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.reward_allocations enable row level security;
alter table public.payouts enable row level security;

-- Financial tables are written only by the API after provider verification.
revoke insert, update, delete on public.reward_pools from authenticated;
revoke insert, update, delete on public.payment_intents from authenticated;
revoke insert, update, delete on public.payment_transactions from authenticated;
revoke insert, update, delete on public.reward_allocations from authenticated;
revoke insert, update, delete on public.payouts from authenticated;

create policy "creators read their funding intents" on public.payment_intents
  for select using (creator_id = auth.uid());

create policy "recipients read their payouts" on public.payouts
  for select using (recipient_id = auth.uid());
