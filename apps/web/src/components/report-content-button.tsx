"use client";

import { useState } from "react";
import { Flag, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

const reasons = [
  ["SAFETY", "Safety concern"],
  ["SPAM", "Spam"],
  ["HARASSMENT", "Harassment"],
  ["MISLEADING", "Misleading content"],
  ["INAPPROPRIATE", "Inappropriate content"],
  ["OTHER", "Something else"],
] as const;

export function ReportContentButton({ subjectType, targetId, returnPath }: { subjectType: "QUEST" | "USER"; targetId: string; returnPath: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("SAFETY");
  const [details, setDetails] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setWorking(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      const response = await fetch(apiUrl("/reports"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subject_type: subjectType, target_id: targetId, reason, details: details.trim() || null }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "The report could not be submitted."));
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be submitted.");
    } finally {
      setWorking(false);
    }
  }

  return <><button onClick={() => setOpen(true)} className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground"><Flag size={14} />Report {subjectType === "QUEST" ? "quest" : "profile"}</button>{open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Report content"><div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 text-foreground shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Community safety</p><h2 className="mt-2 font-display text-2xl font-bold">Report {subjectType === "QUEST" ? "this quest" : "this profile"}</h2></div><button onClick={() => setOpen(false)} aria-label="Close report form" className="grid h-9 w-9 place-items-center rounded-full border border-line"><X size={17} /></button></div>{sent ? <div className="mt-6 rounded-xl bg-accent-soft p-5"><strong>Report received.</strong><p className="mt-1 text-sm leading-6 text-muted">It has been added to the moderation queue. Reporting does not automatically remove content.</p></div> : <><label className="mt-6 block text-sm font-bold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal">{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Details <span className="font-normal text-muted">(optional)</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} minLength={3} maxLength={500} rows={4} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal" placeholder="Share enough context for a reviewer." /></label>{error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm text-[#8f2e1e]">{error}</p> : null}<button onClick={submit} disabled={working || (details.length > 0 && details.trim().length < 3)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-dark px-5 py-3.5 font-bold text-white disabled:opacity-45">{working ? <LoaderCircle className="animate-spin" size={17} /> : <Flag size={17} />}{working ? "Sending…" : "Submit report"}</button></>}</div></div> : null}</>;
}
