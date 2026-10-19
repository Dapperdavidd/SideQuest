"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ImagePlus, LoaderCircle, MapPin, Plus, QrCode, Trash2, UsersRound, WalletCards, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { apiUrl, getMyOrganization, getQuest, getQuestCheckpoints, readApiError, type Organization, type Quest } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";
import { FundingPanel } from "./funding-panel";

type QuestType = "Friends" | "Bounty" | "Explore";
type SelectionMethod = "First valid" | "Best submission";
type Visibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type CheckpointDraft = { id?: string; title: string; instructions: string };

const stepNames = ["Quest", "People", "Proof", "Winners", "Reward", "Review"];

export default function CreateQuestPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineValid, setDeadlineValid] = useState(false);
  const [questType, setQuestType] = useState<QuestType>("Friends");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [isGroup, setIsGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  const [groupInstructions, setGroupInstructions] = useState("");
  const [maxEntries, setMaxEntries] = useState(5);
  const [proof, setProof] = useState<string[]>(["Photo"]);
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>("First valid");
  const [judgingCriteria, setJudgingCriteria] = useState("");
  const [winners, setWinners] = useState(1);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(10);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedQuest, setPublishedQuest] = useState<Quest | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointDraft[]>([{ title: "", instructions: "" }]);
  const [savedCheckpointIds, setSavedCheckpointIds] = useState<string[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sponsoredByBusiness, setSponsoredByBusiness] = useState(false);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [storedCoverUrl, setStoredCoverUrl] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    void createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.replace(`/auth?next=${encodeURIComponent(next)}`);
        return;
      }
      setCheckingAuth(false);
      void getMyOrganization(session.access_token)
        .then((value) => { if (active) setOrganization(value); })
        .catch(() => undefined);

      const questId = new URLSearchParams(window.location.search).get("edit");
      if (!questId || !active) return;
      setLoadingDraft(true);
      try {
        const [draft, savedCheckpoints] = await Promise.all([
          getQuest(questId, session.access_token),
          getQuestCheckpoints(questId, session.access_token),
        ]);
        if (!draft || draft.creator_id !== session.user.id || draft.status !== "DRAFT") {
          throw new Error("Only your unpublished drafts can be edited.");
        }
        if (!active) return;
        setEditingQuestId(draft.id);
        setTitle(draft.title);
        setDescription(draft.description);
        setQuestType(`${draft.quest_type[0]}${draft.quest_type.slice(1).toLowerCase()}` as QuestType);
        setVisibility(draft.visibility);
        setIsGroup(draft.is_group_challenge);
        setGroupSize(draft.required_group_size ?? 2);
        setGroupInstructions(draft.group_instructions ?? "");
        setMaxEntries(draft.max_entries);
        setProof(draft.proof_requirements.map((value) => value === "QR_CHECKPOINT" ? "QR checkpoint" : `${value[0]}${value.slice(1).toLowerCase()}`));
        setSelectionMethod(draft.winner_selection_method === "BEST_SUBMISSION" ? "Best submission" : "First valid");
        setJudgingCriteria(draft.judging_criteria ?? "");
        setWinners(draft.winner_count);
        setRewardEnabled(draft.reward_enabled);
        setRewardAmount(draft.reward_amount_minor ? draft.reward_amount_minor / 100_000 : 10);
        setLocationName(draft.location_name ?? "");
        setLatitude(draft.latitude);
        setLongitude(draft.longitude);
        setStoredCoverUrl(draft.cover_media_url);
        setCoverPreview(draft.cover_media_url);
        setSponsoredByBusiness(Boolean(draft.organization_id));
        const deadlineDate = new Date(draft.deadline);
        deadlineDate.setMinutes(deadlineDate.getMinutes() - deadlineDate.getTimezoneOffset());
        setDeadline(deadlineDate.toISOString().slice(0, 16));
        setDeadlineValid(deadlineDate.getTime() > Date.now());
        if (savedCheckpoints.length) {
          setSavedCheckpointIds(savedCheckpoints.map((checkpoint) => checkpoint.id));
          setCheckpoints(savedCheckpoints.map((checkpoint) => ({ id: checkpoint.id, title: checkpoint.title, instructions: checkpoint.instructions ?? "" })));
        }
      } catch (error) {
        if (active) setDraftLoadError(error instanceof Error ? error.message : "This draft could not be loaded.");
      } finally {
        if (active) setLoadingDraft(false);
      }
    });
    return () => { active = false; };
  }, [router]);

  const totalFunding = useMemo(() => rewardAmount * winners, [rewardAmount, winners]);
  const detailsValid = title.trim().length >= 3 && Boolean(description.trim()) && deadlineValid;
  const locationReady = locationName.trim().length >= 2 && latitude !== null && longitude !== null;
  const locationRequired = proof.includes("Location");
  const checkpointsRequired = proof.includes("QR checkpoint");
  const checkpointsReady = !checkpointsRequired || (checkpoints.length > 0 && checkpoints.every((checkpoint) => checkpoint.title.trim().length >= 2 && (!checkpoint.instructions.trim() || checkpoint.instructions.trim().length >= 2)));

  function toggleProof(value: string) {
    if (value === "Location") setQuestType("Explore");
    setProof((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function updateCheckpoint(index: number, field: keyof CheckpointDraft, value: string) {
    setCheckpoints((current) => current.map((checkpoint, checkpointIndex) => checkpointIndex === index ? { ...checkpoint, [field]: value } : checkpoint));
  }

  function removeCheckpoint(index: number) {
    setCheckpoints((current) => current.filter((_, checkpointIndex) => checkpointIndex !== index));
  }

  function chooseCover(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        setLocating(false);
      },
      () => {
        setLocationError("Allow location access, then try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 },
    );
  }

  async function next() {
    if (step === 0 && !detailsValid) return;
    if (step < 5) setStep((value) => value + 1);
    else await publishQuest();
  }

  async function publishQuest() {
    setPublishing(true);
    setPublishError(null);

    const supabase = createClient();
    let uploadedCoverPath: string | null = null;
    let draftCreated = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth?next=/create");
        return;
      }

      let coverMediaUrl: string | null = storedCoverUrl;
      if (coverFile) {
        if (coverFile.size > 10 * 1024 * 1024) throw new Error("Cover images cannot exceed 10 MB.");
        const extension = coverFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
        uploadedCoverPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("quest-covers").upload(uploadedCoverPath, coverFile, {
          contentType: coverFile.type,
          upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message);
        coverMediaUrl = supabase.storage.from("quest-covers").getPublicUrl(uploadedCoverPath).data.publicUrl;
      }

      const questPayload = {
        title: title.trim(),
        description: description.trim(),
        organization_id: sponsoredByBusiness ? organization?.id ?? null : null,
        cover_media_url: coverMediaUrl,
        location_name: questType === "Explore" && locationReady ? locationName.trim() : null,
        latitude: questType === "Explore" && locationReady ? latitude : null,
        longitude: questType === "Explore" && locationReady ? longitude : null,
        quest_type: questType.toUpperCase(),
        visibility,
        is_group_challenge: isGroup,
        required_group_size: isGroup ? groupSize : null,
        group_instructions: isGroup ? groupInstructions.trim() : null,
        max_entries: maxEntries,
        winner_count: winners,
        winner_selection_method: selectionMethod === "First valid" ? "FIRST_VALID" : "BEST_SUBMISSION",
        proof_requirements: proof.map((value) => value.toUpperCase().replace(" ", "_")),
        judging_criteria: selectionMethod === "Best submission" ? judgingCriteria.trim() : null,
        reward_enabled: rewardEnabled,
        reward_amount_minor: rewardEnabled ? Math.round(rewardAmount * 100_000) : null,
        reward_currency: rewardEnabled ? "NIM" : null,
        settlement_asset: rewardEnabled ? "NIM" : null,
        deadline: new Date(deadline).toISOString(),
      };
      const createdResponse = await fetch(apiUrl(editingQuestId ? `/quests/${editingQuestId}` : "/quests"), {
        method: editingQuestId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(questPayload),
      });
      if (!createdResponse.ok) throw new Error(await readApiError(createdResponse, editingQuestId ? "The draft could not be updated." : "The quest could not be created."));
      const created = await createdResponse.json() as Quest;
      draftCreated = true;

      if (editingQuestId) {
        for (const checkpointId of savedCheckpointIds) {
          const response = await fetch(apiUrl(`/quests/${created.id}/checkpoints/${checkpointId}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!response.ok) throw new Error(await readApiError(response, "The saved checkpoints could not be updated."));
        }
      }

      if (checkpointsRequired) {
        for (const checkpoint of checkpoints) {
          const checkpointResponse = await fetch(apiUrl(`/quests/${created.id}/checkpoints`), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: checkpoint.title.trim(),
              instructions: checkpoint.instructions.trim() || null,
            }),
          });
          if (!checkpointResponse.ok) throw new Error(await readApiError(checkpointResponse, "A checkpoint could not be added to the saved draft."));
        }
      }

      const publishResponse = await fetch(apiUrl(`/quests/${created.id}/publish`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!publishResponse.ok) throw new Error(await readApiError(publishResponse, "The quest draft could not be published."));
      const published = await publishResponse.json() as Quest;
      setPublishedQuest(published);

      if (published.status === "OPEN") router.push(`/quests/${published.id}`);
    } catch (error) {
      if (uploadedCoverPath && !draftCreated) await supabase.storage.from("quest-covers").remove([uploadedCoverPath]);
      setPublishError(error instanceof Error ? error.message : "The quest could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  if (checkingAuth) {
    return <main className="grid min-h-screen place-items-center bg-background"><div role="status" className="flex items-center gap-3 text-sm font-semibold text-muted"><LoaderCircle size={19} className="animate-spin" />Checking your account…</div></main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8">
        <div><Logo /><p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">{editingQuestId ? "Editing draft" : "Create a quest"}</p></div>
        <Link href="/discover" aria-label="Close quest creator" className="grid h-10 w-10 place-items-center rounded-full border border-line"><X size={19} /></Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-8 lg:py-10">
        <section aria-busy={loadingDraft}>
          {loadingDraft ? <div className="mb-5 flex items-center gap-2 rounded-xl bg-white p-4 text-sm font-semibold text-muted"><LoaderCircle size={17} className="animate-spin" />Loading saved draft…</div> : null}
          {draftLoadError ? <div role="alert" className="mb-5 rounded-xl bg-[#fff0ed] p-4 text-sm leading-6 text-[#8f2e1e]"><strong>Draft unavailable.</strong><br />{draftLoadError} <Link href="/quests" className="font-bold underline">Return to My quests</Link></div> : null}
          <div className="overflow-x-auto pb-3">
            <ol className="flex min-w-[620px] items-center">
              {stepNames.map((name, index) => (
                <li key={name} className="flex flex-1 items-center last:flex-none">
                  <button onClick={() => index <= step && setStep(index)} className="flex items-center gap-2 text-left">
                    <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${index <= step ? "bg-accent text-dark" : "bg-[#eceee8] text-muted"}`}>{index < step ? <Check size={15} /> : index + 1}</span>
                    <span className={`text-xs font-semibold ${index === step ? "text-foreground" : "text-muted"}`}>{name}</span>
                  </button>
                  {index < stepNames.length - 1 ? <span className="mx-3 h-px flex-1 bg-line" /> : null}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-line bg-white p-5 shadow-[0_20px_60px_rgba(23,25,23,0.06)] sm:p-8">
            {step === 0 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 1 of 6</p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">What&apos;s the side quest?</h1>
                <p className="mt-2 text-sm text-muted">Make it sound like something people would actually want to try.</p>
                <label className="mt-7 block text-sm font-bold">Quest title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Take the best sunset photo before 6 PM" /></label>
                <label className="mt-5 block text-sm font-bold">What should people do?<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Give people a clear, fun challenge…" /></label>
                <label className="mt-5 block text-sm font-bold">Submission deadline<span className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-background px-4"><CalendarDays size={18} className="text-muted" /><input type="datetime-local" value={deadline} onChange={(event) => { const value = event.target.value; setDeadline(value); setDeadlineValid(new Date(value).getTime() > Date.now()); }} className="w-full bg-transparent py-3 font-normal outline-none" /></span><span className="mt-2 block text-xs font-normal text-muted">Deadlines use your current timezone and cannot be changed after entries begin.</span></label>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {(["Friends", "Bounty", "Explore"] as QuestType[]).map((type) => (
                    <button key={type} onClick={() => { setQuestType(type); if (type !== "Explore") setProof((current) => current.filter((item) => item !== "Location")); }} className={`rounded-xl border p-4 text-left ${questType === type ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-display font-bold">{type}</span><span className="mt-1 block text-xs leading-5 text-muted">{type === "Friends" ? "Challenge your circle" : type === "Bounty" ? "Offer a small reward" : "Create a real-world mission"}</span></button>
                  ))}
                </div>
                {organization?.verification_status === "VERIFIED" ? <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-background p-4"><input type="checkbox" checked={sponsoredByBusiness} onChange={(event) => setSponsoredByBusiness(event.target.checked)} className="mt-1 h-4 w-4 accent-[#9bc800]" /><span><strong className="block text-sm">Publish as {organization.display_name}</strong><span className="mt-1 block text-xs leading-5 text-muted">Shows the verified business identity on this quest while you remain its accountable creator.</span></span></label> : null}
                {questType === "Explore" ? <div className="mt-5 rounded-xl border border-line bg-background p-4"><label className="block text-sm font-bold">Quest location <span className="font-normal text-muted">{locationRequired ? "(required for location proof)" : "(optional)"}</span><input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Freedom Park, Lagos" /></label><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={useCurrentLocation} disabled={locating} className="flex items-center gap-2 rounded-full border border-dark/20 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{locating ? <LoaderCircle size={16} className="animate-spin" /> : <MapPin size={16} />}{locating ? "Getting location…" : latitude === null ? "Use current location" : "Update coordinates"}</button>{latitude !== null && longitude !== null ? <span className="text-xs font-semibold text-muted">Coordinates added</span> : null}</div>{locationError ? <p role="alert" className="mt-3 text-xs text-[#8f2e1e]">{locationError}</p> : null}<p className="mt-3 text-xs leading-5 text-muted">Participants see the place name. Coordinates power nearby discovery; they are supporting context, not automatic proof.</p></div> : null}
                <label className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-muted/50 bg-cover bg-center py-5 text-sm font-semibold text-muted" style={coverPreview ? { backgroundImage: `linear-gradient(rgba(23,25,23,.55),rgba(23,25,23,.55)),url(${JSON.stringify(coverPreview)})`, color: "white" } : undefined}><ImagePlus size={19} /> {coverFile ? "Change cover image" : "Add a cover image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseCover(event.target.files?.[0] ?? null)} /></label>
              </div>
            ) : null}

            {step === 1 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 2 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">Who can take part?</h1><p className="mt-2 text-sm text-muted">Joining shows interest. A slot is only used when an official entry is accepted.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={() => setIsGroup(false)} className={`rounded-xl border p-5 text-left ${!isGroup ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">Individual</span><span className="mt-1 block text-sm text-muted">One person submits one entry.</span></button><button onClick={() => setIsGroup(true)} className={`rounded-xl border p-5 text-left ${isGroup ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="flex items-center gap-2 font-bold"><UsersRound size={18} /> Group challenge</span><span className="mt-1 block text-sm text-muted">One representative submits for the group.</span></button></div>
                <fieldset className="mt-7"><legend className="text-sm font-bold">Quest access</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{(["PUBLIC", "PRIVATE", "INVITE_ONLY"] as Visibility[]).map((value) => <button key={value} onClick={() => setVisibility(value)} className={`rounded-xl border p-4 text-left ${visibility === value ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">{value === "PUBLIC" ? "Public" : value === "PRIVATE" ? "Private" : "Invite only"}</span><span className="mt-1 block text-xs leading-5 text-muted">{value === "PUBLIC" ? "Anyone can discover and join" : "Only people with your invitation link"}</span></button>)}</div></fieldset>
                {isGroup ? <div className="mt-5 space-y-4"><label className="block text-sm font-bold">Required people, including the submitter<input type="number" min={2} max={50} value={groupSize} onChange={(event) => setGroupSize(Math.min(50, Math.max(2, Number(event.target.value))))} className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 font-normal" /></label><label className="block text-sm font-bold">Group instructions<textarea value={groupInstructions} onChange={(event) => setGroupInstructions(event.target.value)} minLength={3} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="Explain who should be in the group and what everyone needs to do together." /></label></div> : null}
                <fieldset className="mt-7"><legend className="text-sm font-bold">Maximum accepted entries</legend><div className="mt-3 flex gap-3">{[3, 5, 10].map((count) => <button key={count} onClick={() => { setMaxEntries(count); setWinners((value) => Math.min(value, count)); }} className={`grid h-12 w-16 place-items-center rounded-xl border font-bold ${maxEntries === count ? "border-dark bg-dark text-white" : "border-line"}`}>{count}</button>)}</div><p className="mt-3 text-xs text-muted">SideQuest never accepts more than 10 official entries.</p></fieldset>
              </div>
            ) : null}

            {step === 2 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 3 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">How do they prove it?</h1><p className="mt-2 text-sm text-muted">Choose one or more evidence types.</p><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">{["Photo", "Video", "Link", "Text", "QR checkpoint", "Location"].map((value) => <button key={value} onClick={() => toggleProof(value)} className={`rounded-xl border p-4 text-left text-sm font-bold ${proof.includes(value) ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}>{proof.includes(value) ? <Check size={16} className="mb-4" /> : value === "QR checkpoint" ? <QrCode size={16} className="mb-4 text-muted" /> : <MapPin size={16} className="mb-4 text-muted" />}{value}</button>)}</div>{locationRequired && !locationReady ? <p className="mt-4 rounded-xl bg-[#fff7df] p-3 text-sm text-[#72500a]">Location proof needs a place name and coordinates. Go back to the Quest step and use the location control.</p> : null}{checkpointsRequired ? <div className="mt-6 rounded-xl border border-line bg-background p-4"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">Ordered checkpoints</h2><p className="mt-1 text-xs leading-5 text-muted">Participants must complete these in order. Private QR codes are created after the draft is saved.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{checkpoints.length}/20</span></div><div className="mt-4 space-y-3">{checkpoints.map((checkpoint, index) => <div key={index} className="rounded-xl border border-line bg-white p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Stop {index + 1}</span><button type="button" onClick={() => removeCheckpoint(index)} disabled={checkpoints.length === 1} aria-label={`Remove checkpoint ${index + 1}`} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-[#fff0ed] hover:text-[#8f2e1e] disabled:opacity-25"><Trash2 size={15} /></button></div><input value={checkpoint.title} onChange={(event) => updateCheckpoint(index, "title", event.target.value)} maxLength={100} className="mt-3 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-foreground" placeholder="Checkpoint title" /><textarea value={checkpoint.instructions} onChange={(event) => updateCheckpoint(index, "instructions", event.target.value)} maxLength={500} rows={2} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-foreground" placeholder="Where to find the code (optional)" /></div>)}</div><button type="button" onClick={() => setCheckpoints((current) => [...current, { title: "", instructions: "" }])} disabled={checkpoints.length >= 20} className="mt-3 flex items-center gap-2 rounded-full border border-dark/20 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40"><Plus size={16} /> Add checkpoint</button>{!checkpointsReady ? <p className="mt-3 text-xs text-[#8f2e1e]">Give every checkpoint a title of at least two characters.</p> : null}</div> : null}</div>
            ) : null}

            {step === 3 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 4 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">How are winners picked?</h1><div className="mt-7 grid gap-3 sm:grid-cols-2">{(["First valid", "Best submission"] as SelectionMethod[]).map((method) => <button key={method} onClick={() => setSelectionMethod(method)} className={`rounded-xl border p-5 text-left ${selectionMethod === method ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">{method}</span><span className="mt-2 block text-sm leading-5 text-muted">{method === "First valid" ? "The earliest qualifying entries win. Submission timestamps cannot be reordered." : "Choose from valid entries using your published criteria."}</span></button>)}</div>{selectionMethod === "Best submission" ? <label className="mt-5 block text-sm font-bold">Published judging criteria<textarea value={judgingCriteria} onChange={(event) => setJudgingCriteria(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 font-normal outline-none focus:border-foreground" placeholder="For example: originality, composition, and how closely the entry follows the brief." /></label> : null}<fieldset className="mt-7"><legend className="text-sm font-bold">Number of winners</legend><div className="mt-3 flex gap-3">{[1, 2, 3].filter((count) => count <= maxEntries).map((count) => <button key={count} onClick={() => setWinners(count)} className={`grid h-12 w-16 place-items-center rounded-xl border font-bold ${winners === count ? "border-dark bg-dark text-white" : "border-line"}`}>{count}</button>)}</div></fieldset></div>
            ) : null}

            {step === 4 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 5 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">Is there a reward?</h1><div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={() => setRewardEnabled(false)} className={`rounded-xl border p-5 text-left ${!rewardEnabled ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="font-bold">Just for fun</span><span className="mt-1 block text-sm text-muted">Recognition and achievements.</span></button><button onClick={() => setRewardEnabled(true)} className={`rounded-xl border p-5 text-left ${rewardEnabled ? "border-[#9bc800] bg-accent-soft" : "border-line"}`}><span className="flex items-center gap-2 font-bold"><WalletCards size={18} /> NIM reward</span><span className="mt-1 block text-sm text-muted">Funded and verified on Nimiq testnet.</span></button></div>{rewardEnabled ? <div className="mt-6 rounded-xl bg-background p-5"><label className="text-sm font-bold">NIM per winner<input type="number" min={0.00001} step={0.00001} value={rewardAmount} onChange={(event) => setRewardAmount(Math.max(0.00001, Number(event.target.value) || 0.00001))} className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-lg font-bold" /></label><div className="mt-5 flex items-center justify-between border-t border-line pt-5"><span className="text-sm text-muted">{winners} winner{winners > 1 ? "s" : ""}</span><span className="font-display text-xl font-bold">{totalFunding} NIM total</span></div><p className="mt-2 text-xs text-muted">The quest opens only after the testnet escrow payment is independently verified.</p></div> : null}</div>
            ) : null}

            {step === 5 ? (
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 6 of 6</p><h1 className="mt-3 font-display text-3xl font-bold">Ready to publish?</h1><div className="mt-7 divide-y divide-line rounded-xl border border-line">{[["Quest", title || "Untitled quest"], ["Type", questType], ...(sponsoredByBusiness && organization ? [["Sponsor", organization.display_name]] : []), ["Access", visibility === "PUBLIC" ? "Public" : "Invitation link only"], ...(questType === "Explore" ? [["Location", locationReady ? locationName.trim() : "Not set"]] : []), ["Deadline", deadline ? new Date(deadline).toLocaleString() : "Not set"], ["Participation", isGroup ? `Group of ${groupSize}` : "Individual"], ...(isGroup ? [["Group instructions", groupInstructions.trim() || "Not set"]] : []), ["Entries", `${maxEntries} maximum`], ["Winners", `${winners} · ${selectionMethod}`], ["Proof", proof.join(", ") || "None selected"], ...(checkpointsRequired ? [["Checkpoints", `${checkpoints.length} in order`]] : []), ["Reward", rewardEnabled ? `${rewardAmount} NIM each · ${totalFunding} NIM total` : "Just for fun"]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-6 px-4 py-4"><span className="text-sm text-muted">{label}</span><span className="max-w-[65%] whitespace-pre-wrap text-right text-sm font-bold">{value}</span></div>)}</div>{rewardEnabled ? <div className="mt-5 rounded-xl bg-[#fff7df] p-4 text-sm leading-6 text-[#72500a]">This quest will enter Awaiting Funding. It will not appear as funded or open until settlement is verified.</div> : null}{publishedQuest?.status === "AWAITING_FUNDING" ? <><div className="mt-5 flex items-start gap-3 rounded-xl bg-accent-soft p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent"><Check size={16} /></span><p className="text-sm leading-6"><strong>Your draft is saved.</strong><br />The NIM reward pool must be funded and verified before this quest can open.</p></div><FundingPanel questId={publishedQuest.id} /></> : null}{publishError ? <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm leading-6 text-[#8f2e1e]">{publishError}</p> : null}</div>
            ) : null}

            <div className="mt-9 flex items-center justify-between border-t border-line pt-5">
              <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold disabled:opacity-30"><ArrowLeft size={17} /> Back</button>
              <button onClick={next} disabled={publishing || (step === 0 && !detailsValid) || (step === 1 && isGroup && groupInstructions.trim().length < 3) || (step === 2 && (proof.length === 0 || (locationRequired && !locationReady) || !checkpointsReady)) || (step === 3 && selectionMethod === "Best submission" && judgingCriteria.trim().length < 3) || (step === 5 && ((isGroup && groupInstructions.trim().length < 3) || (locationRequired && !locationReady) || !checkpointsReady)) || Boolean(publishedQuest)} className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-dark disabled:cursor-not-allowed disabled:opacity-40">{publishing ? <><LoaderCircle size={17} className="animate-spin" /> Publishing…</> : step === 5 ? (rewardEnabled ? "Save and continue to funding" : "Publish quest") : "Continue"}{!publishing ? <ArrowRight size={17} /> : null}</button>
            </div>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-8 overflow-hidden rounded-[1.5rem] border border-line bg-dark text-white shadow-[0_20px_60px_rgba(23,25,23,0.10)]">
            <div className="grid h-44 place-items-center bg-[radial-gradient(circle_at_75%_20%,rgba(199,255,0,0.38),transparent_24%),linear-gradient(135deg,#2f382a,#111411)] bg-cover bg-center" style={coverPreview ? { backgroundImage: `linear-gradient(rgba(23,25,23,.18),rgba(23,25,23,.18)),url(${JSON.stringify(coverPreview)})` } : undefined}>{coverPreview ? null : <ImagePlus className="text-white/35" size={34} />}</div>
            <div className="p-5"><span className="rounded-full bg-accent px-2.5 py-1 text-[0.62rem] font-bold uppercase text-dark">{questType}</span><h2 className="mt-4 font-display text-xl font-bold leading-tight">{title || "Your quest title"}</h2><p className="mt-2 text-sm leading-6 text-white/55">{description || "A clear description will help people know exactly what to do."}</p><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.06] p-3"><strong>{maxEntries}</strong><span className="mt-1 block text-[0.6rem] text-white/40">entries</span></div><div className="rounded-xl bg-white/[0.06] p-3"><strong>{winners}</strong><span className="mt-1 block text-[0.6rem] text-white/40">winner{winners > 1 ? "s" : ""}</span></div><div className="rounded-xl bg-white/[0.06] p-3"><strong>{rewardEnabled ? `${rewardAmount} NIM` : "Fun"}</strong><span className="mt-1 block text-[0.6rem] text-white/40">reward</span></div></div><button className="mt-5 w-full rounded-xl bg-accent py-3 text-sm font-bold text-dark">Take this quest</button></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
