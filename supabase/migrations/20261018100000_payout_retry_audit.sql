alter table public.payouts
  add column current_attempt smallint not null default 1
    check (current_attempt between 1 and 3);

create table public.payout_attempts (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete restrict,
  attempt_number smallint not null check (attempt_number between 1 and 3),
  idempotency_key text not null unique,
  provider_reference text,
  transaction_hash text not null unique,
  status public.payout_status not null,
  submitted_at timestamptz,
  finished_at timestamptz not null default now(),
  failure_reason text,
  unique (payout_id, attempt_number)
);

create index payout_attempts_payout_idx
  on public.payout_attempts (payout_id, attempt_number);

alter table public.payout_attempts enable row level security;
revoke all on public.payout_attempts from anon, authenticated;

comment on table public.payout_attempts is
  'Immutable history of independently failed payout attempts archived before an authorized retry.';
