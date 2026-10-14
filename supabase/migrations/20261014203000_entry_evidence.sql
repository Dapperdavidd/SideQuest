create table public.entry_evidence (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.quest_entries(id) on delete cascade,
  proof_type text not null check (
    proof_type in ('PHOTO', 'VIDEO', 'LINK', 'TEXT', 'QR_CHECKPOINT', 'LOCATION')
  ),
  value text not null check (char_length(trim(value)) between 1 and 2048),
  created_at timestamptz not null default now(),
  unique (entry_id, proof_type)
);

create index entry_evidence_entry_idx on public.entry_evidence (entry_id);

alter table public.entry_evidence enable row level security;

create policy "participants read their evidence"
on public.entry_evidence for select
using (
  exists (
    select 1
    from public.quest_entries
    where quest_entries.id = entry_evidence.entry_id
      and quest_entries.participant_id = auth.uid()
  )
);

create policy "creators read quest evidence"
on public.entry_evidence for select
using (
  exists (
    select 1
    from public.quest_entries
    join public.quests on quests.id = quest_entries.quest_id
    where quest_entries.id = entry_evidence.entry_id
      and quests.creator_id = auth.uid()
  )
);

revoke insert, update, delete on public.entry_evidence from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-media',
  'entry-media',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users upload their entry media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'entry-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users read their entry media"
on storage.objects for select to authenticated
using (
  bucket_id = 'entry-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete unsubmitted entry media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'entry-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1
    from public.entry_evidence
    where entry_evidence.value = storage.objects.name
  )
);

comment on table public.entry_evidence is
  'Immutable proof references accepted atomically with an official quest entry.';
