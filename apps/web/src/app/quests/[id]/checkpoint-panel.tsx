"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Copy, Download, LoaderCircle, LockKeyhole, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { apiUrl, readApiError, type CheckpointCompletion, type QuestCheckpoint } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type CheckpointPanelProps = {
  questId: string;
  initialCheckpoints: QuestCheckpoint[];
  isCreator: boolean;
  joined: boolean;
  isOpen: boolean;
};

export function CheckpointPanel({ questId, initialCheckpoints, isCreator, joined, isOpen }: CheckpointPanelProps) {
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nextCheckpoint = useMemo(() => checkpoints.find((checkpoint) => !checkpoint.completed_at), [checkpoints]);
  const completedCount = checkpoints.filter((checkpoint) => checkpoint.completed_at).length;

  async function completeNextCheckpoint() {
    if (!nextCheckpoint || !code.trim()) return;
    setWorking(true);
    setMessage(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Sign in again to record this checkpoint.");
      const response = await fetch(apiUrl(`/quests/${questId}/checkpoints/${nextCheckpoint.id}/complete`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verification_code: code.trim() }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "This checkpoint could not be completed."));
      const completion = await response.json() as CheckpointCompletion;
      setCheckpoints((current) => current.map((checkpoint) => checkpoint.id === completion.checkpoint_id ? { ...checkpoint, completed_at: completion.completed_at } : checkpoint));
      setCode("");
      setMessage(completion.quest_complete ? "Every checkpoint is complete." : "Checkpoint recorded. The next stop is now unlocked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This checkpoint could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  if (!checkpoints.length) return null;

  return (
    <section className="mt-6 rounded-[1.5rem] border border-line bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">QR route</p><h2 className="mt-2 font-display text-2xl font-bold">Quest checkpoints</h2></div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold">{isCreator ? `${checkpoints.length} codes` : `${completedCount}/${checkpoints.length} complete`}</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{isCreator ? "Place each code at its real-world stop. Codes are private—share the QR image at the location, not the text publicly." : "Visit each stop in order, scan its QR, then paste the code shown by your camera to unlock the next checkpoint."}</p>

      <div className="mt-5 space-y-3">
        {checkpoints.map((checkpoint) => isCreator ? <CreatorCheckpoint key={checkpoint.id} checkpoint={checkpoint} /> : <ParticipantCheckpoint key={checkpoint.id} checkpoint={checkpoint} current={checkpoint.id === nextCheckpoint?.id} />)}
      </div>

      {!isCreator && !joined ? <p className="mt-5 rounded-xl bg-[#fff7df] p-4 text-sm text-[#72500a]">Join this quest before recording checkpoint progress.</p> : null}
      {!isCreator && joined && !isOpen ? <p className="mt-5 rounded-xl bg-background p-4 text-sm text-muted">Checkpoint progress is closed because this quest is no longer open.</p> : null}
      {!isCreator && joined && isOpen && nextCheckpoint ? <div className="mt-5 rounded-xl bg-dark p-5 text-white"><label className="block text-sm font-bold">Code for stop {nextCheckpoint.position}<span className="mt-1 block text-xs font-normal text-white/50">{nextCheckpoint.title}</span><input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="mt-3 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-sm outline-none focus:border-accent" placeholder="Paste the scanned code" /></label><button type="button" onClick={completeNextCheckpoint} disabled={working || !code.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-dark disabled:opacity-40">{working ? <LoaderCircle size={17} className="animate-spin" /> : <QrCode size={17} />} Record checkpoint</button></div> : null}
      {!isCreator && joined && !nextCheckpoint ? <div className="mt-5 flex items-center gap-3 rounded-xl bg-accent-soft p-4 text-sm font-bold"><span className="grid h-8 w-8 place-items-center rounded-full bg-accent"><Check size={17} /></span>All checkpoints completed.</div> : null}
      {message ? <p role="status" className="mt-4 text-sm font-semibold text-muted">{message}</p> : null}
    </section>
  );
}

function ParticipantCheckpoint({ checkpoint, current }: { checkpoint: QuestCheckpoint; current: boolean }) {
  const complete = Boolean(checkpoint.completed_at);
  return <div className={`flex items-start gap-3 rounded-xl border p-4 ${complete ? "border-[#b8dc58] bg-accent-soft" : current ? "border-dark" : "border-line bg-background"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${complete ? "bg-accent" : current ? "bg-dark text-white" : "bg-white text-muted"}`}>{complete ? <Check size={16} /> : checkpoint.position}</span><div className="min-w-0"><strong className="block text-sm">{checkpoint.title}</strong>{checkpoint.instructions ? <p className="mt-1 text-xs leading-5 text-muted">{checkpoint.instructions}</p> : null}<span className="mt-2 flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted">{complete ? "Completed" : current ? "Ready to scan" : <><LockKeyhole size={11} /> Complete earlier stops first</>}</span></div></div>;
}

function CreatorCheckpoint({ checkpoint }: { checkpoint: QuestCheckpoint }) {
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const code = checkpoint.verification_code;

  useEffect(() => {
    if (!code) return;
    let active = true;
    void QRCode.toDataURL(code, { width: 360, margin: 2, color: { dark: "#171917", light: "#ffffff" } }).then((value) => { if (active) setImage(value); });
    return () => { active = false; };
  }, [code]);

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <article className="grid gap-4 rounded-xl border border-line bg-background p-4 sm:grid-cols-[1fr_150px] sm:items-center"><div><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Stop {checkpoint.position}</span><h3 className="mt-1 font-bold">{checkpoint.title}</h3>{checkpoint.instructions ? <p className="mt-2 text-sm leading-6 text-muted">{checkpoint.instructions}</p> : null}{code ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={copyCode} className="flex items-center gap-2 rounded-full border border-dark/15 bg-white px-3 py-2 text-xs font-bold"><Copy size={14} /> {copied ? "Copied" : "Copy code"}</button>{image ? <a href={image} download={`sidequest-stop-${checkpoint.position}.png`} className="flex items-center gap-2 rounded-full border border-dark/15 bg-white px-3 py-2 text-xs font-bold"><Download size={14} /> Download QR</a> : null}</div> : null}</div>{image ? <Image unoptimized src={image} width={150} height={150} alt={`Private QR code for checkpoint ${checkpoint.position}`} className="mx-auto rounded-lg bg-white p-2" /> : <div className="mx-auto grid h-[150px] w-[150px] place-items-center rounded-lg bg-white text-muted"><LoaderCircle className="animate-spin" /></div>}</article>;
}
