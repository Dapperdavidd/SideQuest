create table public.saved_quests (
  user_id uuid not null references public.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

create index saved_quests_user_created_idx
on public.saved_quests (user_id, created_at desc);

alter table public.saved_quests enable row level security;

create policy "users read their saved quests"
on public.saved_quests for select to authenticated
using (auth.uid() = user_id);

create policy "users save public quests"
on public.saved_quests for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.quests
    where quests.id = quest_id
      and quests.visibility = 'PUBLIC'
      and quests.status in ('OPEN', 'CLOSED_FOR_REVIEW', 'REVIEWING', 'FINALIZED')
  )
);

create policy "users remove their saved quests"
on public.saved_quests for delete to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on public.saved_quests from anon;
grant select, insert, delete on public.saved_quests to authenticated;
