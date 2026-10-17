create type notification_kind as enum (
  'NEW_FOLLOWER',
  'QUEST_JOINED',
  'ENTRY_SUBMITTED',
  'ENTRY_APPROVED',
  'ENTRY_REJECTED',
  'QUEST_WON',
  'QUEST_FINALIZED',
  'PAYOUT_CONFIRMED',
  'PAYOUT_FAILED'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  quest_id uuid references public.quests(id) on delete cascade,
  kind notification_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 300),
  href text not null check (href like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null;

alter table public.notifications enable row level security;

create policy "users read their notifications"
on public.notifications for select to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create function public.notify_new_follower() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor_username text;
declare actor_name text;
begin
  select username, display_name into actor_username, actor_name
  from public.users where id = new.follower_id;
  insert into public.notifications (user_id, actor_id, kind, title, body, href)
  values (new.followed_id, new.follower_id, 'NEW_FOLLOWER', 'New follower', actor_name || ' followed you.', '/users/' || actor_username);
  return new;
end;
$$;

create trigger user_follows_notify_insert
after insert on public.user_follows
for each row execute function public.notify_new_follower();

create function public.notify_quest_joined() returns trigger
language plpgsql security definer set search_path = public as $$
declare quest_creator uuid;
declare quest_title text;
declare actor_name text;
begin
  select creator_id, title into quest_creator, quest_title from public.quests where id = new.quest_id;
  select display_name into actor_name from public.users where id = new.user_id;
  if quest_creator <> new.user_id then
    insert into public.notifications (user_id, actor_id, quest_id, kind, title, body, href)
    values (quest_creator, new.user_id, new.quest_id, 'QUEST_JOINED', 'Someone joined your quest', actor_name || ' joined “' || quest_title || '”.', '/quests/' || new.quest_id::text || '/review');
  end if;
  return new;
end;
$$;

create trigger quest_participants_notify_insert
after insert on public.quest_participants
for each row execute function public.notify_quest_joined();

create function public.notify_entry_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare quest_creator uuid;
declare quest_title text;
declare actor_name text;
begin
  select creator_id, title into quest_creator, quest_title from public.quests where id = new.quest_id;
  select display_name into actor_name from public.users where id = new.participant_id;
  insert into public.notifications (user_id, actor_id, quest_id, kind, title, body, href)
  values (quest_creator, new.participant_id, new.quest_id, 'ENTRY_SUBMITTED', 'New quest entry', actor_name || ' submitted an entry to “' || quest_title || '”.', '/quests/' || new.quest_id::text || '/review');
  return new;
end;
$$;

create trigger quest_entries_notify_insert
after insert on public.quest_entries
for each row execute function public.notify_entry_submitted();

create function public.notify_entry_reviewed() returns trigger
language plpgsql security definer set search_path = public as $$
declare participant uuid;
declare related_quest uuid;
declare quest_title text;
begin
  select entry.participant_id, entry.quest_id, quest.title
  into participant, related_quest, quest_title
  from public.quest_entries entry
  join public.quests quest on quest.id = entry.quest_id
  where entry.id = new.entry_id;
  insert into public.notifications (user_id, actor_id, quest_id, kind, title, body, href)
  values (
    participant,
    new.reviewer_id,
    related_quest,
    case when new.is_valid then 'ENTRY_APPROVED'::notification_kind else 'ENTRY_REJECTED'::notification_kind end,
    case when new.is_valid then 'Entry approved' else 'Entry reviewed' end,
    case when new.is_valid then 'Your entry to “' || quest_title || '” was approved.' else 'Your entry to “' || quest_title || '” did not meet the published requirements.' end,
    '/quests/' || related_quest::text
  );
  return new;
end;
$$;

create trigger entry_reviews_notify_change
after insert or update of is_valid, reason on public.entry_reviews
for each row execute function public.notify_entry_reviewed();

create function public.notify_quest_winner() returns trigger
language plpgsql security definer set search_path = public as $$
declare participant uuid;
declare quest_creator uuid;
declare quest_title text;
begin
  select entry.participant_id, quest.creator_id, quest.title
  into participant, quest_creator, quest_title
  from public.quest_entries entry
  join public.quests quest on quest.id = new.quest_id
  where entry.id = new.entry_id;
  insert into public.notifications (user_id, actor_id, quest_id, kind, title, body, href)
  values (participant, quest_creator, new.quest_id, 'QUEST_WON', 'You won a quest', 'You placed #' || new.winner_position::text || ' in “' || quest_title || '”.', '/quests/' || new.quest_id::text);
  return new;
end;
$$;

create trigger quest_winners_notify_insert
after insert on public.quest_winners
for each row execute function public.notify_quest_winner();

create function public.notify_quest_finalized() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'FINALIZED' and new.status = 'FINALIZED' then
    insert into public.notifications (user_id, actor_id, quest_id, kind, title, body, href)
    select participant.user_id, new.creator_id, new.id, 'QUEST_FINALIZED', 'Quest results published', 'The final results for “' || new.title || '” are ready.', '/quests/' || new.id::text
    from public.quest_participants participant
    where participant.quest_id = new.id
      and not exists (
        select 1 from public.quest_winners winner
        join public.quest_entries entry on entry.id = winner.entry_id
        where winner.quest_id = new.id and entry.participant_id = participant.user_id
      );
  end if;
  return new;
end;
$$;

create trigger quests_notify_finalized
after update of status on public.quests
for each row execute function public.notify_quest_finalized();

create function public.notify_payout_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare related_quest uuid;
declare quest_title text;
begin
  if old.status <> new.status and new.status in ('CONFIRMED', 'FAILED') then
    select pool.quest_id, quest.title into related_quest, quest_title
    from public.reward_allocations allocation
    join public.reward_pools pool on pool.id = allocation.reward_pool_id
    join public.quests quest on quest.id = pool.quest_id
    where allocation.id = new.reward_allocation_id;
    insert into public.notifications (user_id, quest_id, kind, title, body, href)
    values (
      new.recipient_id,
      related_quest,
      case when new.status = 'CONFIRMED' then 'PAYOUT_CONFIRMED'::notification_kind else 'PAYOUT_FAILED'::notification_kind end,
      case when new.status = 'CONFIRMED' then 'Reward received' else 'Reward payout needs attention' end,
      case when new.status = 'CONFIRMED' then 'Your NIM reward for “' || quest_title || '” was confirmed.' else 'The NIM payout for “' || quest_title || '” could not be completed.' end,
      '/wallet'
    );
  end if;
  return new;
end;
$$;

create trigger payouts_notify_status
after update of status on public.payouts
for each row execute function public.notify_payout_status();
