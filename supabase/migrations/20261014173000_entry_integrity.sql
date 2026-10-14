-- An accepted entry permanently consumes its slot. Reviews may mark it invalid,
-- but deleting accepted entries would silently reopen capacity and break fairness.
revoke delete on table public.quest_entries from authenticated;

-- Official timestamps are always database-generated. The API passes its current
-- timestamp only inside the same trusted transaction so clients cannot choose it.
alter table public.quest_entries
  alter column submitted_at set default now();

-- Keep accepted-entry counting efficient while the quest row is locked.
create index if not exists quest_entries_quest_id_idx
  on public.quest_entries (quest_id);

comment on table public.quest_entries is
  'Official immutable quest submissions. One row permanently consumes one entry slot.';
