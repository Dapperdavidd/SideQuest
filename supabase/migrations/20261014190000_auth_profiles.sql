create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Explorer'
  );

  insert into public.users (id, username, display_name, avatar_url)
  values (
    new.id,
    'explorer_' || replace(left(new.id::text, 8), '-', ''),
    left(profile_name, 80),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_sidequest_profile on auth.users;
create trigger create_sidequest_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

insert into public.users (id, username, display_name, avatar_url)
select
  auth_user.id,
  'explorer_' || replace(left(auth_user.id::text, 8), '-', ''),
  left(coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(auth_user.email, '@', 1), ''),
    'Explorer'
  ), 80),
  nullif(auth_user.raw_user_meta_data ->> 'avatar_url', '')
from auth.users as auth_user
on conflict (id) do nothing;

create policy "public profiles are readable"
on public.users for select
using (true);

revoke all on function public.create_profile_for_auth_user() from public;
