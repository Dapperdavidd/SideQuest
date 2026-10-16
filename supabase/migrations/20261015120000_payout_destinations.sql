create table public.user_payout_destinations (
  user_id uuid primary key references public.users(id) on delete cascade,
  network text not null check (network = 'testnet'),
  address text not null check (char_length(address) = 44),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quest_entries
  add column payout_network text,
  add column payout_destination_address text,
  add constraint quest_entries_payout_snapshot_check check (
    (payout_network is null and payout_destination_address is null)
    or
    (payout_network = 'testnet' and char_length(payout_destination_address) = 44)
  );

alter table public.user_payout_destinations enable row level security;

revoke insert, update, delete on public.user_payout_destinations from authenticated;

create policy "users read their payout destination"
  on public.user_payout_destinations
  for select using (user_id = auth.uid());
