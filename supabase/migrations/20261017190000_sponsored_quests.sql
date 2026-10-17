alter table public.quests
  add column organization_id uuid references public.organizations(id) on delete restrict;

create index quests_organization_published_idx
  on public.quests (organization_id, published_at desc)
  where organization_id is not null;
