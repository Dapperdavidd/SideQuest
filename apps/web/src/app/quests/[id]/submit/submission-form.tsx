"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Check, FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError, type Quest } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type SubmissionFormProps = {
  quest: Quest;
};

const mediaProofs = new Set(["PHOTO", "VIDEO"]);

export function SubmissionForm({ quest }: SubmissionFormProps) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manualProofRequirements = quest.proof_requirements.filter((proofType) => proofType !== "QR_CHECKPOINT");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const uploadedPaths: string[] = [];
    const supabase = createClient();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(`/quests/${quest.id}/submit`)}`);
        return;
      }

      const evidence: { proof_type: string; value: string }[] = [];
      for (const proofType of manualProofRequirements) {
        if (mediaProofs.has(proofType)) {
          const file = files[proofType];
          if (!file) throw new Error(`Choose a ${proofType.toLowerCase()} file.`);
          if (file.size > 100 * 1024 * 1024) throw new Error("Media files cannot exceed 100 MB.");

          const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || (proofType === "PHOTO" ? "jpg" : "mp4");
          const path = `${session.user.id}/${quest.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("entry-media").upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
          if (uploadError) throw new Error(uploadError.message);
          uploadedPaths.push(path);
          evidence.push({ proof_type: proofType, value: path });
        } else {
          const value = values[proofType]?.trim();
          if (!value) throw new Error(`Add the required ${proofLabel(proofType).toLowerCase()} proof.`);
          evidence.push({ proof_type: proofType, value });
        }
      }

      const response = await fetch(apiUrl(`/quests/${quest.id}/entries`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caption: caption.trim() || null, evidence }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Your entry could not be accepted."));
      setSubmitted(true);
    } catch (caught) {
      if (uploadedPaths.length) await supabase.storage.from("entry-media").remove(uploadedPaths);
      setError(caught instanceof Error ? caught.message : "Your entry could not be accepted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.5rem] border border-line bg-white p-8 text-center shadow-[0_20px_60px_rgba(23,25,23,0.07)]"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft"><Check size={30} /></span><h1 className="mt-5 font-display text-3xl font-bold">Entry submitted</h1><p className="mx-auto mt-3 max-w-md leading-7 text-muted">Your official timestamp is locked in. We&apos;ll notify you when the creator reviews the entry.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href={`/quests/${quest.id}`} className="rounded-full bg-accent px-6 py-3 font-bold text-dark">View quest</Link><Link href="/discover" className="rounded-full border border-line px-6 py-3 font-bold">Explore more quests</Link></div></div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[1.5rem] border border-line bg-white p-5 shadow-[0_20px_60px_rgba(23,25,23,0.07)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Official entry</p>
      <h1 className="mt-3 font-display text-3xl font-bold">Submit your proof</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Once accepted, this consumes one of {quest.max_entries} entry slots and cannot be deleted.</p>

      {quest.proof_requirements.includes("QR_CHECKPOINT") ? <div className="mt-6 flex items-start gap-3 rounded-xl bg-accent-soft p-4"><Check size={18} className="mt-0.5 shrink-0" /><p className="text-sm leading-6"><strong>Checkpoint progress is verified automatically.</strong><br /><span className="text-muted">Complete every stop on the quest page before sending this entry.</span></p></div> : null}

      <div className={manualProofRequirements.length ? "mt-7 space-y-5" : ""}>
        {manualProofRequirements.map((proofType) => (
          <ProofField key={proofType} proofType={proofType} value={values[proofType] ?? ""} onValue={(value) => setValues((current) => ({ ...current, [proofType]: value }))} onFile={(file) => setFiles((current) => ({ ...current, [proofType]: file }))} />
        ))}
      </div>

      <label className="mt-6 block text-sm font-bold">Caption <span className="font-normal text-muted">(optional)</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={280} rows={3} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Tell the creator a little about your entry…" /><span className="mt-1 block text-right text-xs font-normal text-muted">{caption.length}/280</span></label>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm leading-6 text-[#8f2e1e]">{error}</p> : null}
      <button disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-4 font-bold text-dark disabled:opacity-50">{submitting ? <LoaderCircle size={18} className="animate-spin" /> : <FileUp size={18} />}{submitting ? "Securing your entry…" : "Submit official entry"}</button>
    </form>
  );
}

function ProofField({ proofType, value, onValue, onFile }: { proofType: string; value: string; onValue: (value: string) => void; onFile: (file: File | null) => void }) {
  const label = proofLabel(proofType);
  if (mediaProofs.has(proofType)) {
    return <label className="block text-sm font-bold">{label}<span className="mt-2 block rounded-xl border border-dashed border-muted/50 bg-background p-5 text-center"><FileUp size={22} className="mx-auto text-muted" /><span className="mt-2 block text-sm font-normal text-muted">Choose {proofType === "PHOTO" ? "a JPG, PNG, or WebP image" : "an MP4, MOV, or WebM video"}</span><input required type="file" accept={proofType === "PHOTO" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,video/webm"} onChange={(event) => onFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-xs font-normal text-muted file:mr-3 file:rounded-full file:border-0 file:bg-dark file:px-4 file:py-2 file:font-bold file:text-white" /></span></label>;
  }

  const textarea = proofType === "TEXT";
  return <label className="block text-sm font-bold">{label}{textarea ? <textarea required value={value} onChange={(event) => onValue(event.target.value)} rows={4} maxLength={2048} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Write the requested proof…" /> : <input required value={value} onChange={(event) => onValue(event.target.value)} type={proofType === "LINK" ? "url" : "text"} maxLength={2048} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder={proofPlaceholder(proofType)} />}</label>;
}

function proofLabel(proofType: string) {
  return proofType.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase());
}

function proofPlaceholder(proofType: string) {
  if (proofType === "LINK") return "https://example.com/your-proof";
  if (proofType === "LOCATION") return "Venue or precise location";
  return "Add your proof";
}
