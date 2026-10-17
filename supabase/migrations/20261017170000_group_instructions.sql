alter table public.quests
  add column group_instructions text;

alter table public.quests
  add constraint quests_group_instructions_check check (
    (is_group_challenge and char_length(trim(group_instructions)) between 3 and 500)
    or (not is_group_challenge and group_instructions is null)
  );
