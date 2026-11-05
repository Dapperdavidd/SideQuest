"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, CalendarDays, CircleCheck, CircleX, Clock3, LoaderCircle, LockKeyhole, Pencil, Share2, Trophy, UsersRound, WalletCards, X } from "lucide-react";
import { SpotsMeter } from "@/components/spots-meter";
import { useRouter } from "next/navigation";
import { apiUrl, formatDeadline, questCover, readApiError, type MyQuestSummary } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

const tabs = ["Active", "Completed", "Created", "Joined", "Saved"] as const;
type Tab = typeof tabs[number];

export function MyQuestsList({ quests }: { quests: MyQuestSummary[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Active");
  const [workingQuest, setWorkingQuest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = quests.filter((quest) => matches(quest, tab));

  return (
    <>
      <div className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{tabs.map((name) => <button key={name} type="button" aria-pressed={tab === name} onClick={() => setTab(name)} className="sq-chip">{name}<span className="font-mono text-[11px] opacity-60">{quests.filter((quest) => matches(quest, name)).length}</span></button>)}</div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-coral-tint px-4 py-3 text-sm text-danger">{error}</p> : null}
      {filtered.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{filtered.map((quest) => <QuestRow key={`${quest.relationship}-${quest.id}`} quest={quest} working={workingQuest === quest.id} onAction={act} />)}</div> : <div className="mt-5 rounded-[26px] border-2 border-dashed border-line bg-surface p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime-tint">{tab === "Saved" ? <Bookmark size={21} /> : <Trophy size={21} />}</span><h2 className="mt-4 font-display text-xl font-black uppercase">Nothing here yet</h2><p className="mt-2 text-sm text-ink-2">{tab === "Saved" ? "Save quests from their detail pages and they will stay here." : "Your created and joined quests will stay organized here."}</p><Link href="/discover" className="sq-btn sq-btn-lime mt-5">Discover bounties</Link></div>}
    </>
  );

  async function act(quest: MyQuestSummary, action: "close" | "cancel") {
    if (action === "cancel" && !window.confirm("Cancel this quest? This cannot be undone.")) return;
    setWorkingQuest(quest.id);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Sign in again to manage this quest.");
      const response = await fetch(apiUrl(`/quests/${quest.id}/${action}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, `Unable to ${action} this quest.`));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${action} this quest.`);
    } finally {
      setWorkingQuest(null);
    }
  }
}

function matches(quest: MyQuestSummary, tab: Tab) {
  if (tab === "Saved") return quest.relationship === "SAVED";
  if (quest.relationship === "SAVED") return false;
  if (tab === "Completed") return quest.status === "FINALIZED";
  if (tab === "Created") return quest.relationship === "CREATOR";
  if (tab === "Joined") return quest.relationship === "PARTICIPANT";
  return !["FINALIZED", "CANCELLED", "SUSPENDED"].includes(quest.status);
}

function QuestRow({ quest, working, onAction }: { quest: MyQuestSummary; working: boolean; onAction: (quest: MyQuestSummary, action: "close" | "cancel") => void }) {
  const reviewable = quest.relationship === "CREATOR" && ["CLOSED_FOR_REVIEW", "REVIEWING"].includes(quest.status);
  const editable = quest.relationship === "CREATOR" && quest.status === "DRAFT";
  const fundable = quest.relationship === "CREATOR" && quest.status === "AWAITING_FUNDING";
  const publicQuest = quest.relationship === "SAVED" || ["OPEN", "CLOSED_FOR_REVIEW", "REVIEWING", "FINALIZED"].includes(quest.status);
  const href = editable ? `/create?edit=${quest.id}` : fundable ? `/quests/${quest.id}/fund` : reviewable ? `/quests/${quest.id}/review` : publicQuest ? `/quests/${quest.id}` : null;
  const closable = quest.relationship === "CREATOR" && quest.status === "OPEN";
  const cancellable = quest.relationship === "CREATOR" && (quest.status === "DRAFT" || quest.status === "AWAITING_FUNDING" || (quest.status === "OPEN" && !quest.reward_enabled && quest.entries_received === 0));
  const outcome = participantOutcome(quest);
  const used = Math.min(quest.entries_received, quest.max_entries);
  const role = quest.relationship === "CREATOR" ? "Created by you" : quest.relationship === "SAVED" ? "Saved" : "Joined";
  const card = (
    <article className="relative mt-3 h-full rounded-[26px] border border-line bg-surface shadow-[var(--shadow-card)] transition hover:-translate-y-0.5">
      <span className="sq-sticker absolute -top-3 left-5 -rotate-3 border border-line bg-surface text-ink">{role}</span>
      <div className="flex gap-4 p-5 pt-6">
        <img src={questCover({ id: quest.id, cover_media_url: null, quest_type: quest.quest_type })} alt="" className="h-20 w-16 flex-none -rotate-2 rounded-xl object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={`sq-pill self-start ${quest.status === "OPEN" ? "bg-lime text-on-lime" : quest.status === "AWAITING_FUNDING" ? "bg-lime-tint text-ink" : "bg-sunken text-ink-2"}`}>{quest.status.replaceAll("_", " ")}</span>
          <h2 className="font-display text-[22px] font-black uppercase leading-[0.92] tracking-[-0.03em]">{quest.title}</h2>
          <span className="flex items-center gap-3 text-xs text-ink-2"><span className="flex items-center gap-1"><CalendarDays size={13} aria-hidden="true" />{formatDeadline(quest.deadline)}</span><span className="flex items-center gap-1"><UsersRound size={13} aria-hidden="true" />{quest.participants_joined} joined</span><span>{quest.quest_type === "FRIENDS" ? "Friends" : "Bounty"}</span></span>
        </div>
      </div>
      <div className="sq-ticket-tear flex items-end justify-between px-5 pb-4 pt-3">
        <span className="flex flex-col gap-1"><span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink-3">Reward</span><span className="font-display text-xl font-black uppercase leading-none">{quest.reward_enabled && quest.reward_amount_minor ? `${quest.reward_amount_minor / 100_000} NIM` : "Glory"}</span></span>
        <span className="flex flex-col items-end gap-1.5"><span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink-3">{quest.entries_received}/{quest.max_entries} entries</span><SpotsMeter total={quest.max_entries} used={used} /></span>
      </div>
      {outcome ? <div className={`mx-5 mb-4 rounded-2xl p-3 text-sm ${outcome.tone}`}><p className="flex items-center gap-2 font-bold">{outcome.icon}{outcome.title}</p>{outcome.detail ? <p className="mt-1 text-xs leading-5 opacity-80">{outcome.detail}</p> : null}</div> : null}
      {editable ? <p className="flex items-center gap-2 px-5 pb-4 text-sm font-bold"><Pencil size={15} aria-hidden="true" />Resume editing</p> : fundable ? <p className="px-5 pb-4 text-sm font-bold">Complete NIM funding</p> : reviewable ? <p className="px-5 pb-4 text-sm font-bold">Review entries</p> : null}
    </article>
  );
  const shareable = quest.relationship === "CREATOR" && ["OPEN", "AWAITING_FUNDING"].includes(quest.status);
  return <div>{href ? <Link href={href}>{card}</Link> : card}{closable || cancellable || shareable ? <div className="mt-2 flex gap-2">{shareable ? <Link href={`/quests/${quest.id}/share`} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-3 py-2.5 text-xs font-bold"><Share2 size={14} aria-hidden="true" />Share link</Link> : null}{closable ? <button disabled={working} onClick={() => onAction(quest, "close")} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-3 py-2.5 text-xs font-bold disabled:opacity-50">{working ? <LoaderCircle size={14} className="animate-spin" /> : <LockKeyhole size={14} />}Close submissions</button> : null}{cancellable ? <button disabled={working} onClick={() => onAction(quest, "cancel")} className="flex items-center justify-center gap-2 rounded-full border border-danger/30 px-3 py-2.5 text-xs font-bold text-danger disabled:opacity-50"><X size={14} />Cancel</button> : null}</div> : null}</div>;
}

function participantOutcome(quest: MyQuestSummary) {
  if (quest.relationship !== "PARTICIPANT" || !quest.viewer_entry_id) return null;
  if (quest.viewer_is_winner) {
    const payout = quest.viewer_payout_status ? `Reward payout: ${quest.viewer_payout_status.toLowerCase()}.` : quest.reward_enabled ? "Your reward is being prepared." : "You earned the winning place.";
    return { title: "You won this quest", detail: payout, tone: "bg-lime-tint text-ink", icon: <Trophy size={16} /> };
  }
  if (quest.viewer_entry_status === "INVALID") return { title: "Entry not accepted", detail: quest.viewer_review_reason ?? "The creator marked this entry invalid.", tone: "bg-coral-tint text-danger", icon: <CircleX size={16} /> };
  if (quest.viewer_entry_status === "VALID" && quest.status === "FINALIZED") return { title: "Valid entry · not selected", detail: "Your entry met the rules but was not one of the winning entries.", tone: "bg-sunken text-ink-2", icon: <CircleCheck size={16} /> };
  if (quest.viewer_entry_status === "VALID") return { title: "Entry marked valid", detail: "Final results are still pending.", tone: "bg-lime-tint text-ink", icon: <CircleCheck size={16} /> };
  if (quest.viewer_payout_status) return { title: "Reward payout update", detail: quest.viewer_payout_status.toLowerCase(), tone: "bg-lime-tint text-ink", icon: <WalletCards size={16} /> };
  return { title: "Entry submitted", detail: "Waiting for creator review.", tone: "bg-sunken text-ink-2", icon: <Clock3 size={16} /> };
}
