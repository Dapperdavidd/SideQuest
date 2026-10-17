alter table public.quests
  add column location_name text,
  add column latitude double precision,
  add column longitude double precision;

alter table public.quests
  add constraint quests_location_name_length
    check (location_name is null or char_length(trim(location_name)) between 2 and 120),
  add constraint quests_location_coordinates
    check (
      (location_name is null and latitude is null and longitude is null)
      or (
        location_name is not null
        and latitude between -90 and 90
        and longitude between -180 and 180
      )
    );

create index quests_location_idx
  on public.quests (latitude, longitude)
  where latitude is not null and longitude is not null;
