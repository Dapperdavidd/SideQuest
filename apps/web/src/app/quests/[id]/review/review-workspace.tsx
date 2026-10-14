"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, LoaderCircle, Trophy, X } from "lucide-react";
import { apiUrl, readApiError, type CreatorEntry, type Quest } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function ReviewWorkspace({ quest, initialEntries, initialSignedUrls }: { quest: Quest; initialEntries: CreatorEntry[]; initialSignedUrls: Record<string, string> }) {
  const [entries, setEntries] = useState<CreatorEntry[]>(initialEntries);
  const signedUrls = initialSignedUrls;
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(initialEntries.map((entry) => [entry.id, entry.review_reason ?? ""])));
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalized, setFinalized] = useState<string[] | null>(quest.status === "FINALIZED" ? [] : null);

  const allReviewed = entries.length > 0 && entries.every((entry) => entry.review_is_valid !== null);
  const validEntries = useMemo(() => entries.filter((entry) => entry.review_is_valid), [entries]);

  async function review(entryId: string, isValid: boolean) {
    setWorking(entryId);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Your session has expired.");
      const response = await fetch(apiUrl(`/quests/${quest.id}/entries/${entryId}/review`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_valid: isValid, reason: reasons[entryId]?.trim() || null }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to save this review."));
      setEntries((current) => current.map((entry) => entry.id === entryId ? { ...entry, review_is_valid: isValid, review_reason: reasons[entryId]?.trim() || null } : entry));
      if (!isValid) setSelectedWinners((current) => current.filter((id) => id !== entryId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this review.");
    } finally {
      setWorking(null);
    }
  }

  function toggleWinner(entryId: string) {
    setSelectedWinners((current) => current.includes(entryId) ? current.filter((id) => id !== entryId) : current.length < quest.winner_count ? [...current, entryId] : current);
  }

  async function finalize() {
    setWorking("finalize");
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Your session has expired.");
      const response = await fetch(apiUrl(`/quests/${quest.id}/finalize`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ winner_entry_ids: quest.winner_selection_method === "BEST_SUBMISSION" ? selectedWinners : [] }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to finalize this quest."));
      const result = await response.json() as { winner_entry_ids: string[] };
      setFinalized(result.winner_entry_ids);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to finalize this quest.");
    } finally {
      setWorking(null);
    }
  }

  if (finalized) return <div className="rounded-[1.5rem] border border-line bg-white p-8 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft"><Trophy size={28} /></span><h1 className="mt-5 font-display text-3xl font-bold">Quest finalized</h1><p className="mt-3 text-muted">{finalized.length ? `${finalized.length} winner${finalized.length === 1 ? "" : "s"} locked in.` : "The published result is locked in."}</p><Link href={`/quests/${quest.id}`} className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-bold text-dark">View public quest</Link></div>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Creator review</p><h1 className="mt-2 font-display text-3xl font-bold">{quest.title}</h1><p className="mt-2 text-sm text-muted">Review every entry. Invalid entries still permanently consume their slot.</p></div><span className="rounded-full bg-accent-soft px-4 py-2 text-sm font-bold">{entries.length}/{quest.max_entries} submitted</span></div>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#8f2e1e]">{error}</p> : null}
      {!entries.length ? <div className="mt-6 rounded-[1.5rem] border border-dashed border-line bg-white p-10 text-center"><h2 className="font-display text-xl font-bold">No entries yet</h2><p className="mt-2 text-sm text-muted">Return after the first participant submits their proof.</p></div> : <div className="mt-6 space-y-4">{entries.map((entry, index) => <EntryReviewCard key={entry.id} entry={entry} number={index + 1} reason={reasons[entry.id] ?? ""} signedUrls={signedUrls} working={working === entry.id} bestSubmission={quest.winner_selection_method === "BEST_SUBMISSION"} selected={selectedWinners.includes(entry.id)} onReason={(value) => setReasons((current) => ({ ...current, [entry.id]: value }))} onReview={(isValid) => review(entry.id, isValid)} onWinner={() => toggleWinner(entry.id)} />)}</div>}

      {entries.length ? <div className="mt-6 rounded-[1.5rem] border border-line bg-white p-6"><h2 className="font-display text-xl font-bold">Finalize results</h2><p className="mt-2 text-sm leading-6 text-muted">{quest.winner_selection_method === "FIRST_VALID" ? "Winners are calculated from valid entries using the trusted submission timestamp. You cannot reorder them." : `Select ${Math.min(quest.winner_count, validEntries.length)} valid winner${Math.min(quest.winner_count, validEntries.length) === 1 ? "" : "s"} before finalizing.`}</p><button onClick={finalize} disabled={!allReviewed || working !== null || (quest.winner_selection_method === "BEST_SUBMISSION" && selectedWinners.length !== Math.min(quest.winner_count, validEntries.length))} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-dark px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{working === "finalize" ? <LoaderCircle size={18} className="animate-spin" /> : <Trophy size={18} />}Finalize quest</button></div> : null}
    </div>
  );
}

function EntryReviewCard({ entry, number, reason, signedUrls, working, bestSubmission, selected, onReason, onReview, onWinner }: { entry: CreatorEntry; number: number; reason: string; signedUrls: Record<string, string>; working: boolean; bestSubmission: boolean; selected: boolean; onReason: (value: string) => void; onReview: (isValid: boolean) => void; onWinner: () => void }) {
  return <article className="rounded-[1.5rem] border border-line bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-[0.15em] text-muted">Entry {number}</span><h2 className="mt-1 font-display text-xl font-bold">{entry.participant_display_name}</h2><p className="text-sm text-muted">@{entry.participant_username} · {new Date(entry.submitted_at).toLocaleString()}</p></div>{entry.review_is_valid === null ? <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-muted">Pending</span> : <span className={`rounded-full px-3 py-1 text-xs font-bold ${entry.review_is_valid ? "bg-accent-soft" : "bg-[#fff0ed] text-[#8f2e1e]"}`}>{entry.review_is_valid ? "Valid" : "Invalid"}</span>}</div>{entry.caption ? <p className="mt-4 rounded-xl bg-background p-4 text-sm leading-6">{entry.caption}</p> : null}<div className="mt-4 grid gap-2 sm:grid-cols-2">{entry.evidence.map((evidence) => <div key={evidence.proof_type} className="rounded-xl border border-line p-4"><span className="text-xs font-bold uppercase text-muted">{evidence.proof_type.replaceAll("_", " ")}</span>{signedUrls[evidence.value] ? <a href={signedUrls[evidence.value]} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-sm font-bold underline decoration-accent decoration-2 underline-offset-4">Open private proof <ExternalLink size={14} /></a> : <p className="mt-2 break-words text-sm leading-6">{evidence.value}</p>}</div>)}</div><label className="mt-4 block text-sm font-bold">Review note <span className="font-normal text-muted">(optional)</span><input value={reason} onChange={(event) => onReason(event.target.value)} maxLength={500} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none" placeholder="Explain your decision to the participant" /></label><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => onReview(true)} disabled={working} className="flex items-center justify-center gap-2 rounded-xl bg-accent-soft px-4 py-3 font-bold disabled:opacity-50"><Check size={17} /> Mark valid</button><button onClick={() => onReview(false)} disabled={working} className="flex items-center justify-center gap-2 rounded-xl bg-[#fff0ed] px-4 py-3 font-bold text-[#8f2e1e] disabled:opacity-50"><X size={17} /> Mark invalid</button></div>{bestSubmission && entry.review_is_valid ? <button onClick={onWinner} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold ${selected ? "border-dark bg-dark text-white" : "border-line"}`}><Trophy size={17} />{selected ? "Selected as winner" : "Select as winner"}</button> : null}</article>;
}
