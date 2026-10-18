alter table public.users
  add column account_status text not null default 'ACTIVE'
    check (account_status in ('ACTIVE', 'SUSPENDED'));

create table public.user_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  moderator_id uuid not null references public.users(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  suspended_at timestamptz not null default now(),
  reinstated_by uuid references public.users(id) on delete restrict,
  reinstated_at timestamptz,
  reinstatement_note text check (
    reinstatement_note is null
    or char_length(trim(reinstatement_note)) between 3 and 500
  ),
  check (
    (reinstated_at is null and reinstated_by is null)
    or (reinstated_at is not null and reinstated_by is not null)
  )
);

create unique index user_suspensions_active_unique
  on public.user_suspensions (user_id)
  where reinstated_at is null;

create index user_suspensions_history_idx
  on public.user_suspensions (user_id, suspended_at desc);

alter table public.user_suspensions enable row level security;
revoke all on public.user_suspensions from anon, authenticated;

alter type public.notification_kind add value if not exists 'ACCOUNT_SUSPENDED';
alter type public.notification_kind add value if not exists 'ACCOUNT_REINSTATED';

comment on table public.user_suspensions is
  'Server-only audit history for administrator account suspensions and reinstatements.';
