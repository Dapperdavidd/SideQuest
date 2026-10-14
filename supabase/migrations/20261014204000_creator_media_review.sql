create policy "creators read entry media for their quests"
on storage.objects for select to authenticated
using (
  bucket_id = 'entry-media'
  and exists (
    select 1
    from public.quests
    where quests.id::text = (storage.foldername(storage.objects.name))[2]
      and quests.creator_id = auth.uid()
  )
);

comment on policy "creators read entry media for their quests" on storage.objects is
  'Allows a quest creator to issue short-lived signed URLs for evidence uploaded under that quest folder.';
