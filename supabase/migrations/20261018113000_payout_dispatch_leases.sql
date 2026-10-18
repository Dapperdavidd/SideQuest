alter table public.payouts
  add column dispatch_started_at timestamptz;

create index payouts_pending_dispatch_idx
  on public.payouts (created_at, id)
  where status = 'PENDING';

comment on column public.payouts.dispatch_started_at is
  'Short claim lease for signer dispatch. A stale lease may be reclaimed because signer requests are idempotent and persist the signed transaction before broadcast.';
