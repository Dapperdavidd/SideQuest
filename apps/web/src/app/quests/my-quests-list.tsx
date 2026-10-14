"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Trophy, UsersRound } from "lucide-react";
import { formatDeadline, type MyQuestSummary } from "@/lib/api/quests";

const tabs = ["Active", "Completed", "Created", "Joined"] as const;
type Tab = typeof tabs[number];

export function MyQuestsList({ quests }: { quests: MyQuestSummary[] }) {
  const [tab, setTab] = useState<Tab>("Active");
  const filtered = quests.filter((quest) => {
    if (tab === "Completed") return quest.status === "FINALIZED";
    if (tab === "Created") return quest.relationship === "CREATOR";
    if (tab === "Joined") return quest.relationship === "PARTICIPANT";
    return !["FINALIZED", "CANCELLED", "SUSPENDED"].includes(quest.status);
  });

  return (
    <>
      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{tabs.map((name) => <button key={name} onClick={() => setTab(name)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === name ? "bg-dark text-white" : "border border-line bg-white text-muted"}`}>{name}</button>)}</div>
      {filtered.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{filtered.map((quest) => <QuestRow key={`${quest.relationship}-${quest.id}`} quest={quest} />)}</div> : <div className="mt-5 rounded-[1.5rem] border border-dashed border-line bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft"><Trophy size={21} /></span><h2 className="mt-4 font-display text-xl font-bold">Nothing here yet</h2><p className="mt-2 text-sm text-muted">Your created and joined quests will stay organized here.</p><Link href="/discover" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark">Discover quests</Link></div>}
    </>
  );
}

function QuestRow({ quest }: { quest: MyQuestSummary }) {
  const reviewable = quest.relationship === "CREATOR" && ["CLOSED_FOR_REVIEW", "REVIEWING"].includes(quest.status);
  const publicQuest = ["OPEN", "CLOSED_FOR_REVIEW", "REVIEWING", "FINALIZED"].includes(quest.status);
  const href = reviewable ? `/quests/${quest.id}/review` : publicQuest ? `/quests/${quest.id}` : null;
  const card = <article className="h-full rounded-[1.25rem] border border-line bg-white p-5 shadow-[0_12px_40px_rgba(23,25,23,0.05)]"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{quest.relationship === "CREATOR" ? "Created by you" : "Joined"}</span><h2 className="mt-2 font-display text-xl font-bold">{quest.title}</h2></div><span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase ${quest.status === "OPEN" ? "bg-accent-soft" : quest.status === "AWAITING_FUNDING" ? "bg-[#fff7df] text-[#72500a]" : "bg-background text-muted"}`}>{quest.status.replaceAll("_", " ")}</span></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-background p-3"><strong>{quest.entries_received}/{quest.max_entries}</strong><span className="mt-1 block text-[0.62rem] text-muted">entries</span></div><div className="rounded-xl bg-background p-3"><strong>{quest.participants_joined}</strong><span className="mt-1 block text-[0.62rem] text-muted">joined</span></div><div className="rounded-xl bg-background p-3"><strong>{quest.quest_type.slice(0, 1)}</strong><span className="mt-1 block text-[0.62rem] text-muted">type</span></div></div><div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted"><span className="flex items-center gap-1.5"><CalendarDays size={14} /> {formatDeadline(quest.deadline)}</span><span className="flex items-center gap-1.5"><UsersRound size={14} /> {quest.quest_type.toLowerCase()}</span></div>{reviewable ? <p className="mt-4 font-bold text-[#698a00]">Review submissions →</p> : quest.status === "AWAITING_FUNDING" ? <p className="mt-4 text-sm font-bold text-[#72500a]">Funding verification required</p> : null}</article>;
  return href ? <Link href={href}>{card}</Link> : card;
}
