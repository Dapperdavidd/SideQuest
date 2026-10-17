create table public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx
  on public.user_blocks (blocked_id, created_at desc);

alter table public.user_blocks enable row level security;

create policy "users read blocks they created"
on public.user_blocks for select
using (auth.uid() = blocker_id);

revoke insert, update, delete on public.user_blocks from anon, authenticated;

comment on table public.user_blocks is
  'One-way safety blocks managed by the API; creating a block also removes follows in both directions.';
