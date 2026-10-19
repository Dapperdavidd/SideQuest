"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, CalendarDays, CircleCheck, CircleX, Clock3, LoaderCircle, LockKeyhole, Pencil, Trophy, UsersRound, WalletCards, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, formatDeadline, readApiError, type MyQuestSummary } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

const tabs = ["Active", "Completed", "Created", "Joined", "Saved"] as const;
type Tab = typeof tabs[number];

export function MyQuestsList({ quests }: { quests: MyQuestSummary[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Active");
  const [workingQuest, setWorkingQuest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = quests.filter((quest) => {
    if (tab === "Saved") return quest.relationship === "SAVED";
    if (quest.relationship === "SAVED") return false;
    if (tab === "Completed") return quest.status === "FINALIZED";
    if (tab === "Created") return quest.relationship === "CREATOR";
    if (tab === "Joined") return quest.relationship === "PARTICIPANT";
    return !["FINALIZED", "CANCELLED", "SUSPENDED"].includes(quest.status);
  });

  return (
    <>
      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{tabs.map((name) => <button key={name} onClick={() => setTab(name)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === name ? "bg-dark text-white" : "border border-line bg-white text-muted"}`}>{name}</button>)}</div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#8f2e1e]">{error}</p> : null}
      {filtered.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{filtered.map((quest) => <QuestRow key={`${quest.relationship}-${quest.id}`} quest={quest} working={workingQuest === quest.id} onAction={act} />)}</div> : <div className="mt-5 rounded-[1.5rem] border border-dashed border-line bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft">{tab === "Saved" ? <Bookmark size={21} /> : <Trophy size={21} />}</span><h2 className="mt-4 font-display text-xl font-bold">Nothing here yet</h2><p className="mt-2 text-sm text-muted">{tab === "Saved" ? "Save quests from their detail pages and they will stay here." : "Your created and joined quests will stay organized here."}</p><Link href="/discover" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark">Discover quests</Link></div>}
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

function QuestRow({ quest, working, onAction }: { quest: MyQuestSummary; working: boolean; onAction: (quest: MyQuestSummary, action: "close" | "cancel") => void }) {
  const reviewable = quest.relationship === "CREATOR" && ["CLOSED_FOR_REVIEW", "REVIEWING"].includes(quest.status);
  const editable = quest.relationship === "CREATOR" && quest.status === "DRAFT";
  const fundable = quest.relationship === "CREATOR" && quest.status === "AWAITING_FUNDING";
  const publicQuest = quest.relationship === "SAVED" || ["OPEN", "CLOSED_FOR_REVIEW", "REVIEWING", "FINALIZED"].includes(quest.status);
  const href = editable ? `/create?edit=${quest.id}` : fundable ? `/quests/${quest.id}/fund` : reviewable ? `/quests/${quest.id}/review` : publicQuest ? `/quests/${quest.id}` : null;
  const closable = quest.relationship === "CREATOR" && quest.status === "OPEN";
  const cancellable = quest.relationship === "CREATOR" && (quest.status === "DRAFT" || quest.status === "AWAITING_FUNDING" || (quest.status === "OPEN" && !quest.reward_enabled && quest.entries_received === 0));
  const outcome = participantOutcome(quest);
  const card = <article className="h-full rounded-[1.25rem] border border-line bg-white p-5 shadow-[0_12px_40px_rgba(23,25,23,0.05)]"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{quest.relationship === "CREATOR" ? "Created by you" : quest.relationship === "SAVED" ? "Saved quest" : "Joined"}</span><h2 className="mt-2 font-display text-xl font-bold">{quest.title}</h2></div><span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase ${quest.status === "OPEN" ? "bg-accent-soft" : quest.status === "AWAITING_FUNDING" ? "bg-[#fff7df] text-[#72500a]" : "bg-background text-muted"}`}>{quest.status.replaceAll("_", " ")}</span></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-background p-3"><strong>{quest.entries_received}/{quest.max_entries}</strong><span className="mt-1 block text-[0.62rem] text-muted">entries</span></div><div className="rounded-xl bg-background p-3"><strong>{quest.participants_joined}</strong><span className="mt-1 block text-[0.62rem] text-muted">joined</span></div><div className="rounded-xl bg-background p-3"><strong>{quest.quest_type.slice(0, 1)}</strong><span className="mt-1 block text-[0.62rem] text-muted">type</span></div></div><div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted"><span className="flex items-center gap-1.5"><CalendarDays size={14} /> {formatDeadline(quest.deadline)}</span><span className="flex items-center gap-1.5"><UsersRound size={14} /> {quest.quest_type.toLowerCase()}</span></div>{outcome ? <div className={`mt-4 rounded-xl p-3 text-sm ${outcome.tone}`}><p className="flex items-center gap-2 font-bold">{outcome.icon}{outcome.title}</p>{outcome.detail ? <p className="mt-1 text-xs leading-5 opacity-75">{outcome.detail}</p> : null}</div> : null}{editable ? <p className="mt-4 flex items-center gap-2 font-bold text-[#698a00]"><Pencil size={15} />Resume editing →</p> : fundable ? <p className="mt-4 font-bold text-[#72500a]">Complete NIM funding →</p> : reviewable ? <p className="mt-4 font-bold text-[#698a00]">Review submissions →</p> : null}</article>;
  return <div>{href ? <Link href={href}>{card}</Link> : card}{closable || cancellable ? <div className="mt-2 flex gap-2">{closable ? <button disabled={working} onClick={() => onAction(quest, "close")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold disabled:opacity-50">{working ? <LoaderCircle size={14} className="animate-spin" /> : <LockKeyhole size={14} />}Close submissions</button> : null}{cancellable ? <button disabled={working} onClick={() => onAction(quest, "cancel")} className="flex items-center justify-center gap-2 rounded-xl border border-[#f2c7bf] bg-[#fff7f5] px-3 py-2.5 text-xs font-bold text-[#8f2e1e] disabled:opacity-50"><X size={14} />Cancel</button> : null}</div> : null}</div>;
}

function participantOutcome(quest: MyQuestSummary) {
  if (quest.relationship !== "PARTICIPANT" || !quest.viewer_entry_id) return null;
  if (quest.viewer_is_winner) {
    const payout = quest.viewer_payout_status ? `Reward payout: ${quest.viewer_payout_status.toLowerCase()}.` : quest.reward_enabled ? "Your reward is being prepared." : "You earned the winning place.";
    return { title: "You won this quest", detail: payout, tone: "bg-accent-soft text-[#3f5600]", icon: <Trophy size={16} /> };
  }
  if (quest.viewer_entry_status === "INVALID") return { title: "Entry not accepted", detail: quest.viewer_review_reason ?? "The creator marked this entry invalid.", tone: "bg-[#fff0ed] text-[#8f2e1e]", icon: <CircleX size={16} /> };
  if (quest.viewer_entry_status === "VALID" && quest.status === "FINALIZED") return { title: "Valid entry · not selected", detail: "Your entry met the rules but was not one of the winning entries.", tone: "bg-background text-muted", icon: <CircleCheck size={16} /> };
  if (quest.viewer_entry_status === "VALID") return { title: "Entry marked valid", detail: "Final results are still pending.", tone: "bg-accent-soft text-[#3f5600]", icon: <CircleCheck size={16} /> };
  if (quest.viewer_payout_status) return { title: "Reward payout update", detail: quest.viewer_payout_status.toLowerCase(), tone: "bg-[#fff7df] text-[#72500a]", icon: <WalletCards size={16} /> };
  return { title: "Entry submitted", detail: "Waiting for creator review.", tone: "bg-background text-muted", icon: <Clock3 size={16} /> };
}
