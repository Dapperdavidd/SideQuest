create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users(id) on delete restrict,
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  display_name text not null check (char_length(trim(display_name)) between 2 and 100),
  description text check (description is null or char_length(trim(description)) between 3 and 500),
  website_url text check (website_url is null or char_length(website_url) <= 2048),
  logo_url text check (logo_url is null or char_length(logo_url) <= 2048),
  verification_status text not null default 'PENDING'
    check (verification_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((verification_status = 'VERIFIED') = (verified_at is not null))
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'ADMIN')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organizations_verified_created_idx
  on public.organizations (created_at desc)
  where verification_status = 'VERIFIED';

create index organization_members_user_idx
  on public.organization_members (user_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "verified organizations are public"
  on public.organizations for select
  using (verification_status = 'VERIFIED');

create policy "members can read their organization"
  on public.organizations for select to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = organizations.id
        and member.user_id = auth.uid()
    )
  );

create policy "members can read membership"
  on public.organization_members for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.organizations from anon, authenticated;
revoke insert, update, delete on public.organization_members from anon, authenticated;
