create extension if not exists pgcrypto;

create type quest_type as enum ('FRIENDS', 'BOUNTY', 'EXPLORE');
create type quest_visibility as enum ('PUBLIC', 'PRIVATE', 'INVITE_ONLY');
create type winner_selection_method as enum ('FIRST_VALID', 'BEST_SUBMISSION');
create type quest_status as enum ('DRAFT', 'AWAITING_FUNDING', 'OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED', 'CANCELLED', 'SUSPENDED');
create type entry_status as enum ('SUBMITTED', 'UNDER_REVIEW', 'VALID', 'INVALID');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id),
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 1 and 2000),
  cover_media_url text,
  quest_type quest_type not null,
  visibility quest_visibility not null default 'PUBLIC',
  is_group_challenge boolean not null default false,
  required_group_size smallint,
  max_entries smallint not null check (max_entries between 1 and 10),
  winner_count smallint not null check (winner_count between 1 and 3 and winner_count <= max_entries),
  winner_selection_method winner_selection_method not null,
  reward_enabled boolean not null default false,
  reward_amount_minor bigint check (reward_amount_minor is null or reward_amount_minor > 0),
  reward_currency char(3),
  settlement_asset text,
  deadline timestamptz not null,
  status quest_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,
  check ((is_group_challenge and required_group_size >= 2) or (not is_group_challenge and required_group_size is null)),
  check ((reward_enabled and reward_amount_minor is not null and reward_currency is not null) or (not reward_enabled and reward_amount_minor is null))
);

create table public.quest_entries (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id),
  participant_id uuid not null references public.users(id),
  status entry_status not null default 'SUBMITTED',
  caption text check (char_length(caption) <= 280),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_reason text,
  unique (quest_id, participant_id)
);

create index quest_entries_order_idx on public.quest_entries (quest_id, submitted_at, id);
alter table public.users enable row level security;
alter table public.quests enable row level security;
alter table public.quest_entries enable row level security;

create policy "public quests are readable" on public.quests for select using (visibility = 'PUBLIC' and status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED'));
create policy "users read their own profile" on public.users for select using (auth.uid() = id);
create policy "participants read their entries" on public.quest_entries for select using (auth.uid() = participant_id);
