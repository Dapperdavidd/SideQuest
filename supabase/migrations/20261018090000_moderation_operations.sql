alter table public.content_reports
  add column reviewed_by uuid references public.users(id) on delete set null,
  add column resolution_note text,
  add column updated_at timestamptz not null default now(),
  add check (
    resolution_note is null
    or char_length(trim(resolution_note)) between 3 and 500
  );

alter table public.organizations
  add column reviewed_by uuid references public.users(id) on delete set null,
  add column verification_reason text,
  add check (
    verification_reason is null
    or char_length(trim(verification_reason)) between 3 and 500
  );

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.users(id) on delete restrict,
  target_type text not null check (target_type in ('REPORT', 'ORGANIZATION')),
  target_id uuid not null,
  action text not null check (
    action in (
      'REPORT_REVIEWING',
      'REPORT_RESOLVED',
      'REPORT_DISMISSED',
      'ORGANIZATION_VERIFIED',
      'ORGANIZATION_REJECTED'
    )
  ),
  note text check (note is null or char_length(trim(note)) between 3 and 500),
  created_at timestamptz not null default now()
);

create index moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc);

create index moderation_actions_moderator_idx
  on public.moderation_actions (moderator_id, created_at desc);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;

alter type public.notification_kind add value if not exists 'BUSINESS_VERIFIED';
alter type public.notification_kind add value if not exists 'BUSINESS_REJECTED';

comment on table public.moderation_actions is
  'Immutable server-written audit history for report and business-verification decisions.';
