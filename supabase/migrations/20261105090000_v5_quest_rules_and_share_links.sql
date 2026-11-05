-- SideQuest v5: Bounties cap at 7 entries, the Explore mode folds into Bounty + hunt,
-- every quest gets a short share code, and hunt stops gain a geofence.

-- 1. Retire the Explore mode. Existing Explore quests become Bounties; any checkpoints they
--    already have make them hunts automatically.
update public.quests set quest_type = 'BOUNTY' where quest_type = 'EXPLORE';

alter table public.quests
  add constraint quests_no_explore_mode check (quest_type <> 'EXPLORE');

-- 2. Seven official entries at most for new or edited rules. Quests published under the old
--    limit keep their immutable rules, so the cap is enforced only when max_entries is written.
create or replace function public.enforce_v5_entry_cap()
returns trigger
language plpgsql
as $$
begin
  if new.max_entries > 7 and (tg_op = 'INSERT' or new.max_entries is distinct from old.max_entries) then
    raise exception 'max_entries must be between 1 and 7' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger quests_enforce_v5_entry_cap
  before insert or update of max_entries on public.quests
  for each row execute function public.enforce_v5_entry_cap();

-- 3. Short share codes: 6 characters, base32 without look-alike characters (0, 1, I, L, O).
create or replace function public.generate_quest_short_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  attempt int := 0;
begin
  loop
    candidate := '';
    for i in 1..6 + (attempt / 10) loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.quests where short_code = candidate);
    attempt := attempt + 1;
  end loop;
  return candidate;
end;
$$;

alter table public.quests add column short_code text;

update public.quests set short_code = public.generate_quest_short_code() where short_code is null;

alter table public.quests
  alter column short_code set not null,
  add constraint quests_short_code_format check (short_code ~ '^[2-9A-HJKMNP-Z]{6,8}$'),
  add constraint quests_short_code_unique unique (short_code);

create or replace function public.assign_quest_short_code()
returns trigger
language plpgsql
as $$
begin
  if new.short_code is null then
    new.short_code := public.generate_quest_short_code();
  end if;
  return new;
end;
$$;

create trigger quests_assign_short_code
  before insert on public.quests
  for each row execute function public.assign_quest_short_code();

-- Anonymous scan and open counts per quest for the creator's stats. No personal data.
create table public.quest_link_opens (
  id bigint generated always as identity primary key,
  quest_id uuid not null references public.quests(id) on delete cascade,
  opened_at timestamptz not null default now()
);

create index quest_link_opens_quest_idx on public.quest_link_opens (quest_id, opened_at desc);

alter table public.quest_link_opens enable row level security;
revoke all on public.quest_link_opens from anon, authenticated;

-- 4. Scavenger hunts: 2 to 8 stops, each with an optional geofence (default 75 m) and a QR code.
alter table public.quests
  add column hunt_ordered boolean not null default true;

alter table public.quest_checkpoints
  add column latitude double precision check (latitude is null or latitude between -90 and 90),
  add column longitude double precision check (longitude is null or longitude between -180 and 180),
  add column radius_m smallint not null default 75 check (radius_m between 25 and 500),
  add constraint quest_checkpoints_coordinates_pair check ((latitude is null) = (longitude is null));

create or replace function public.enforce_hunt_stop_limit()
returns trigger
language plpgsql
as $$
begin
  if new.position > 8 then
    raise exception 'a hunt has at most 8 stops' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger quest_checkpoints_enforce_stop_limit
  before insert or update of position on public.quest_checkpoints
  for each row execute function public.enforce_hunt_stop_limit();
