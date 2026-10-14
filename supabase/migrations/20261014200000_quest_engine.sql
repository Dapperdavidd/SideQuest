alter table public.quests
  add column proof_requirements text[] not null default array['PHOTO']::text[],
  add column judging_criteria text;

alter table public.quests
  add constraint quests_proof_requirements_count
    check (cardinality(proof_requirements) between 1 and 6),
  add constraint quests_proof_requirements_values
    check (proof_requirements <@ array['PHOTO', 'VIDEO', 'LINK', 'TEXT', 'QR_CHECKPOINT', 'LOCATION']::text[]),
  add constraint quests_judging_criteria
    check (
      winner_selection_method <> 'BEST_SUBMISSION'
      or char_length(trim(judging_criteria)) between 3 and 500
    );

create table public.quest_participants (
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);

create index quests_discovery_idx
  on public.quests (status, visibility, published_at desc)
  where visibility = 'PUBLIC';

create index quest_participants_user_idx
  on public.quest_participants (user_id, joined_at desc);

alter table public.quest_participants enable row level security;

create policy "participants read their memberships"
on public.quest_participants for select
using (auth.uid() = user_id);

create policy "creators read quest memberships"
on public.quest_participants for select
using (
  exists (
    select 1
    from public.quests
    where quests.id = quest_participants.quest_id
      and quests.creator_id = auth.uid()
  )
);

create policy "creators read their quests"
on public.quests for select
using (auth.uid() = creator_id);

revoke insert, update, delete on public.quests from anon, authenticated;
revoke insert, update, delete on public.quest_participants from anon, authenticated;
