insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quest-covers',
  'quest-covers',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users upload their quest covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'quest-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update their quest covers"
on storage.objects for update to authenticated
using (
  bucket_id = 'quest-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'quest-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete their quest covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'quest-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on column public.quests.cover_media_url is
  'Public URL for an image stored in the quest-covers bucket; uploads are owner-scoped by their first path segment.';
