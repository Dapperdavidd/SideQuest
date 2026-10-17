create type public.report_subject_type as enum ('QUEST', 'USER');
create type public.report_reason as enum (
  'SAFETY', 'SPAM', 'HARASSMENT', 'MISLEADING', 'INAPPROPRIATE', 'OTHER'
);
create type public.report_status as enum ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  subject_type public.report_subject_type not null,
  quest_id uuid references public.quests(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (details is null or char_length(trim(details)) between 3 and 500),
  check (
    (subject_type = 'QUEST' and quest_id is not null and user_id is null)
    or (subject_type = 'USER' and user_id is not null and quest_id is null)
  )
);

create unique index content_reports_open_quest_unique
  on public.content_reports (reporter_id, quest_id)
  where quest_id is not null and status in ('OPEN', 'REVIEWING');

create unique index content_reports_open_user_unique
  on public.content_reports (reporter_id, user_id)
  where user_id is not null and status in ('OPEN', 'REVIEWING');

create index content_reports_moderation_queue_idx
  on public.content_reports (status, created_at);

alter table public.content_reports enable row level security;

create policy "reporters read their reports"
on public.content_reports for select
using (auth.uid() = reporter_id);

revoke insert, update, delete on public.content_reports from anon, authenticated;

comment on table public.content_reports is
  'User-submitted safety reports retained as a moderation queue; clients cannot alter report status.';
