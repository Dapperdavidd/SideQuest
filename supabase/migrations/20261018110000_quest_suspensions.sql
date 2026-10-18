create table public.quest_suspensions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete restrict,
  moderator_id uuid not null references public.users(id) on delete restrict,
  previous_status public.quest_status not null,
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

create unique index quest_suspensions_active_unique
  on public.quest_suspensions (quest_id)
  where reinstated_at is null;

create index quest_suspensions_history_idx
  on public.quest_suspensions (quest_id, suspended_at desc);

alter table public.quest_suspensions enable row level security;
revoke all on public.quest_suspensions from anon, authenticated;

alter type public.notification_kind add value if not exists 'QUEST_SUSPENDED';
alter type public.notification_kind add value if not exists 'QUEST_REINSTATED';

comment on table public.quest_suspensions is
  'Server-only audit history for administrator quest suspensions and reinstatements.';
