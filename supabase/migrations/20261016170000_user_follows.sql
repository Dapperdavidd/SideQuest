create table public.user_follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followed_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index user_follows_followed_created_idx
on public.user_follows (followed_id, created_at desc);

create index user_follows_follower_created_idx
on public.user_follows (follower_id, created_at desc);

alter table public.user_follows enable row level security;

create policy "follow relationships are publicly readable"
on public.user_follows for select
using (true);

create policy "users create their own follows"
on public.user_follows for insert to authenticated
with check (auth.uid() = follower_id and follower_id <> followed_id);

create policy "users remove their own follows"
on public.user_follows for delete to authenticated
using (auth.uid() = follower_id);

revoke insert, update, delete on public.user_follows from anon;
grant select on public.user_follows to anon;
grant select, insert, delete on public.user_follows to authenticated;
