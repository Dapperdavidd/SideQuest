"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Copy, Download, LoaderCircle, QrCode } from "lucide-react";
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

function currentPosition() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This stop checks your location, and this browser cannot share it."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error("Allow location access so SideQuest can confirm you are at this stop.")),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  });
}

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
      const position = nextCheckpoint.latitude !== null ? await currentPosition() : null;
      const response = await fetch(apiUrl(`/quests/${questId}/checkpoints/${nextCheckpoint.id}/complete`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verification_code: code.trim(), latitude: position?.latitude, longitude: position?.longitude }),
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
    <div className="flex flex-col gap-4 rounded-[28px] border border-line bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-2xl font-black uppercase tracking-[-0.03em]">{isCreator ? "Your stop codes" : "Your progress"}</h3>
        <span className="sq-sticker sq-sticker-lime">{isCreator ? `${checkpoints.length} codes` : `${completedCount}/${checkpoints.length} found`}</span>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-ink-2">{isCreator ? "Print each QR and place it at its real stop. Keep the codes private; share the printed QR at the location, never the text." : "At each stop, scan its QR with your camera and paste the code here. Stops with a zone also check that you are there."}</p>
      {isCreator ? <div className="flex flex-col gap-3">{checkpoints.map((checkpoint) => <CreatorCheckpoint key={checkpoint.id} checkpoint={checkpoint} />)}</div> : null}
      {!isCreator && !joined ? <p className="rounded-2xl bg-lime-tint p-4 text-sm">Join this quest to start the hunt.</p> : null}
      {!isCreator && joined && !isOpen ? <p className="rounded-2xl bg-sunken p-4 text-sm text-ink-2">This hunt is closed, so new scans are not recorded.</p> : null}
      {!isCreator && joined && isOpen && nextCheckpoint ? (
        <div className="flex flex-col gap-3 rounded-[22px] bg-inv p-5 text-on-inv">
          <label className="flex flex-col gap-1 text-sm font-bold">Code for stop {nextCheckpoint.position}<span className="text-xs font-normal opacity-70">{nextCheckpoint.title}</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="mt-2 h-12 rounded-full border border-white/20 bg-white/10 px-4 font-mono text-sm text-on-inv outline-none" placeholder="Paste the scanned code" />
          </label>
          <button type="button" onClick={completeNextCheckpoint} disabled={working || !code.trim()} className="sq-btn sq-btn-lime">{working ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <QrCode size={17} aria-hidden="true" />}Record stop</button>
        </div>
      ) : null}
      {!isCreator && joined && !nextCheckpoint ? <div className="flex items-center gap-3 rounded-2xl bg-lime p-4 text-sm font-bold text-on-lime"><Check size={18} aria-hidden="true" />Every stop found. Submit your entry to finish.</div> : null}
      {message ? <p role="status" className="text-sm font-semibold text-ink-2">{message}</p> : null}
    </div>
  );
}

function CreatorCheckpoint({ checkpoint }: { checkpoint: QuestCheckpoint }) {
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const code = checkpoint.verification_code;

  useEffect(() => {
    if (!code) return;
    let active = true;
    void QRCode.toDataURL(code, { width: 360, margin: 2, color: { dark: "#111111", light: "#ffffff" } }).then((value) => { if (active) setImage(value); });
    return () => { active = false; };
  }, [code]);

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <article className="grid gap-4 rounded-[20px] border border-line bg-sunken p-4 sm:grid-cols-[1fr_150px] sm:items-center"><div><span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-2">Stop {checkpoint.position}</span><h3 className="mt-1 font-bold">{checkpoint.title}</h3>{checkpoint.instructions ? <p className="mt-2 text-sm leading-6 text-ink-2">{checkpoint.instructions}</p> : null}{code ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={copyCode} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold"><Copy size={14} /> {copied ? "Copied" : "Copy code"}</button>{image ? <a href={image} download={`sidequest-stop-${checkpoint.position}.png`} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold"><Download size={14} /> Download QR</a> : null}</div> : null}</div>{image ? <Image unoptimized src={image} width={150} height={150} alt={`Private QR code for checkpoint ${checkpoint.position}`} className="mx-auto rounded-lg bg-white p-2" /> : <div className="mx-auto grid h-[150px] w-[150px] place-items-center rounded-lg bg-white text-ink-2"><LoaderCircle className="animate-spin" /></div>}</article>;
}
