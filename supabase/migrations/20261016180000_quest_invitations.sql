create table public.quest_invitations (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  creator_id uuid not null references public.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  max_uses smallint not null check (max_uses between 1 and 10),
  use_count smallint not null default 0 check (use_count between 0 and max_uses),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index quest_invitations_creator_quest_idx
on public.quest_invitations (creator_id, quest_id, created_at desc);

create index quest_invitations_token_idx
on public.quest_invitations (token);

alter table public.quest_invitations enable row level security;

create policy "creators read their quest invitations"
on public.quest_invitations for select to authenticated
using (auth.uid() = creator_id);

revoke insert, update, delete on public.quest_invitations from anon, authenticated;
grant select on public.quest_invitations to authenticated;
