alter table public.payment_intents
  add column recipient_address text,
  add column payment_reference text;

create unique index payment_intents_reference_idx
  on public.payment_intents (payment_reference)
  where payment_reference is not null;

create index payment_intents_active_pool_idx
  on public.payment_intents (reward_pool_id, expires_at desc)
  where status in ('CREATED', 'PENDING');
