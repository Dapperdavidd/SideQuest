create table public.quest_checkpoints (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text not null check (char_length(trim(title)) between 2 and 100),
  instructions text check (instructions is null or char_length(trim(instructions)) between 2 and 500),
  verification_code uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  unique (quest_id, position)
);

create table public.checkpoint_progress (
  checkpoint_id uuid not null references public.quest_checkpoints(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (checkpoint_id, user_id)
);

create index quest_checkpoints_quest_order_idx
  on public.quest_checkpoints (quest_id, position);

create index checkpoint_progress_user_idx
  on public.checkpoint_progress (user_id, completed_at desc);

alter table public.quest_checkpoints enable row level security;
alter table public.checkpoint_progress enable row level security;

revoke all on public.quest_checkpoints from anon, authenticated;
revoke all on public.checkpoint_progress from anon, authenticated;
