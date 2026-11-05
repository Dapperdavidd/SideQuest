-- SideQuest v5: Friends challenges live in rooms and are won by vote. Mutual friendships
-- replace followers for people (follow stays for organizations), groups hold challenges,
-- organizations get a free badge, and the Verified badge becomes a paid plan.

alter type public.winner_selection_method add value if not exists 'ROOM_VOTE';
alter type public.notification_kind add value if not exists 'FRIEND_REQUEST';
alter type public.notification_kind add value if not exists 'FRIEND_ACCEPTED';
alter type public.notification_kind add value if not exists 'CHALLENGE_RECEIVED';
alter type public.notification_kind add value if not exists 'VOTING_OPEN';
alter type public.notification_kind add value if not exists 'GROUP_JOINED';

-- Friendly stakes are text only ("Loser buys suya"); never money.
alter table public.quests
  add column friendly_stake text check (friendly_stake is null or char_length(trim(friendly_stake)) between 2 and 120),
  add constraint quests_stake_only_on_friends check (friendly_stake is null or quest_type = 'FRIENDS'),
  add constraint quests_friends_have_no_money check (quest_type <> 'FRIENDS' or reward_enabled = false);

-- Mutual friendships: one row per pair, requested by one side and accepted by the other.
create table public.friendships (
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'ACCEPTED')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id),
  check ((status = 'ACCEPTED') = (accepted_at is not null))
);

create unique index friendships_pair_unique
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);

-- Friend groups ("rooms"): 2 to 50 members, one owner, joined by invite link or QR.
create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  invite_code text not null unique default public.generate_quest_short_code()
    check (invite_code ~ '^[2-9A-HJKMNP-Z]{6,8}$'),
  created_at timestamptz not null default now()
);

create table public.friend_group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index friend_group_members_user_idx on public.friend_group_members (user_id, joined_at desc);

create or replace function public.enforce_friend_group_size()
returns trigger
language plpgsql
as $$
begin
  perform 1 from public.friend_groups where id = new.group_id for update;
  if (select count(*) from public.friend_group_members where group_id = new.group_id) >= 50 then
    raise exception 'a friend group has at most 50 members' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger friend_group_members_enforce_size
  before insert on public.friend_group_members
  for each row execute function public.enforce_friend_group_size();

-- Who a Friends challenge was sent to: one group, or a list of people (all friends or picked).
alter table public.quests
  add column group_id uuid references public.friend_groups(id) on delete set null,
  add column votes_close_at timestamptz,
  add constraint quests_group_only_on_friends check (group_id is null or quest_type = 'FRIENDS');

create index quests_group_idx on public.quests (group_id, created_at desc) where group_id is not null;

create table public.quest_audience (
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);

create index quest_audience_user_idx on public.quest_audience (user_id, added_at desc);

-- Room votes: one per member per challenge, never for your own entry. Results stay hidden
-- until the window closes; the API never returns tallies before votes_close_at.
create table public.challenge_votes (
  quest_id uuid not null references public.quests(id) on delete cascade,
  voter_id uuid not null references public.users(id) on delete cascade,
  entry_id uuid not null references public.quest_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quest_id, voter_id)
);

create index challenge_votes_entry_idx on public.challenge_votes (entry_id);

-- Profile privacy. Both permissions default to Friends.
alter table public.users
  add column profile_visibility text not null default 'PUBLIC' check (profile_visibility in ('PUBLIC', 'PRIVATE')),
  add column challenge_permission text not null default 'FRIENDS' check (challenge_permission in ('FRIENDS', 'NOBODY')),
  add column group_invite_permission text not null default 'FRIENDS' check (group_invite_permission in ('FRIENDS', 'NOBODY'));

-- Organizations: the Organization badge is free from creation; Verified is a paid plan.
alter table public.organizations
  add column category text check (category is null or char_length(trim(category)) between 2 and 40),
  add column social_handle text check (social_handle is null or char_length(trim(social_handle)) between 2 and 60),
  add column plan text not null default 'FREE' check (plan in ('FREE', 'VERIFIED')),
  add column founding_partner boolean not null default false,
  add column verified_until timestamptz,
  add column eligibility_snapshot jsonb;

-- Seed existing mutual follows as friendships so nobody loses their people.
insert into public.friendships (requester_id, addressee_id, status, created_at, accepted_at)
select a.follower_id, a.followed_id, 'ACCEPTED', greatest(a.created_at, b.created_at), greatest(a.created_at, b.created_at)
from public.user_follows a
join public.user_follows b on b.follower_id = a.followed_id and b.followed_id = a.follower_id
where a.follower_id < a.followed_id
on conflict do nothing;

alter table public.friendships enable row level security;
alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.quest_audience enable row level security;
alter table public.challenge_votes enable row level security;
revoke all on public.friendships, public.friend_groups, public.friend_group_members,
  public.quest_audience, public.challenge_votes from anon, authenticated;
