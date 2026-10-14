create table public.entry_reviews (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.quest_entries(id),
  reviewer_id uuid not null references public.users(id),
  is_valid boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (entry_id)
);

create table public.quest_winners (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id),
  entry_id uuid not null references public.quest_entries(id),
  winner_position smallint not null check (winner_position between 1 and 3),
  finalized_at timestamptz not null default now(),
  unique (quest_id, entry_id),
  unique (quest_id, winner_position)
);

create index entry_reviews_reviewer_idx on public.entry_reviews (reviewer_id, created_at desc);
create index quest_winners_quest_idx on public.quest_winners (quest_id, winner_position);

alter table public.entry_reviews enable row level security;
alter table public.quest_winners enable row level security;

create policy "creators read reviews for their quests" on public.entry_reviews
  for select using (
    exists (
      select 1
      from public.quest_entries entry
      join public.quests quest on quest.id = entry.quest_id
      where entry.id = entry_reviews.entry_id and quest.creator_id = auth.uid()
    )
  );

create policy "finalized winners are public" on public.quest_winners
  for select using (
    exists (
      select 1 from public.quests quest
      where quest.id = quest_winners.quest_id and quest.status = 'FINALIZED'
    )
  );

-- Inserts and updates are intentionally not granted to clients. The API writes
-- review and winner records after verifying creator authority and selection rules.
revoke insert, update, delete on public.entry_reviews from authenticated;
revoke insert, update, delete on public.quest_winners from authenticated;
