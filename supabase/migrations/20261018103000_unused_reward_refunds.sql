alter table public.payouts
  alter column reward_allocation_id drop not null,
  add column reward_pool_id uuid references public.reward_pools(id),
  add column payout_kind text not null default 'WINNER_REWARD';

alter table public.payouts
  add constraint payouts_source_check check (
    (payout_kind = 'WINNER_REWARD' and reward_allocation_id is not null and reward_pool_id is null)
    or
    (payout_kind = 'CREATOR_REFUND' and reward_allocation_id is null and reward_pool_id is not null)
  );

create unique index payouts_one_creator_refund_per_pool_idx
  on public.payouts (reward_pool_id)
  where payout_kind = 'CREATOR_REFUND';

create index payouts_kind_status_idx
  on public.payouts (payout_kind, status, created_at);

create or replace function public.notify_payout_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare related_pool uuid;
declare related_quest uuid;
declare quest_title text;
begin
  if old.status <> new.status and new.status in ('CONFIRMED', 'FAILED') then
    if new.payout_kind = 'CREATOR_REFUND' then
      related_pool := new.reward_pool_id;
    else
      select allocation.reward_pool_id into related_pool
      from public.reward_allocations allocation
      where allocation.id = new.reward_allocation_id;
    end if;

    select pool.quest_id, quest.title into related_quest, quest_title
    from public.reward_pools pool
    join public.quests quest on quest.id = pool.quest_id
    where pool.id = related_pool;

    insert into public.notifications (user_id, quest_id, kind, title, body, href)
    values (
      new.recipient_id,
      related_quest,
      case when new.status = 'CONFIRMED' then 'PAYOUT_CONFIRMED'::notification_kind else 'PAYOUT_FAILED'::notification_kind end,
      case
        when new.payout_kind = 'CREATOR_REFUND' and new.status = 'CONFIRMED' then 'Unused reward returned'
        when new.payout_kind = 'CREATOR_REFUND' then 'Reward refund needs attention'
        when new.status = 'CONFIRMED' then 'Reward received'
        else 'Reward payout needs attention'
      end,
      case
        when new.payout_kind = 'CREATOR_REFUND' and new.status = 'CONFIRMED' then 'Unused NIM from “' || quest_title || '” was returned to the original funding address.'
        when new.payout_kind = 'CREATOR_REFUND' then 'The unused-reward refund for “' || quest_title || '” could not be completed.'
        when new.status = 'CONFIRMED' then 'Your NIM reward for “' || quest_title || '” was confirmed.'
        else 'The NIM payout for “' || quest_title || '” could not be completed.'
      end,
      case when new.payout_kind = 'CREATOR_REFUND' then '/quests/' || related_quest || '/settlement' else '/wallet' end
    );
  end if;
  return new;
end;
$$;

comment on column public.payouts.payout_kind is
  'WINNER_REWARD pays an immutable reward allocation; CREATOR_REFUND returns unused funded winner positions to the independently verified original sender.';
