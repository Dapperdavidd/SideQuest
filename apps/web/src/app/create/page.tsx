"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, FileText, ImagePlus, Link2, LoaderCircle, MapPin, Plus, QrCode, Route, Trash2, Trophy, UsersRound, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiUrl, getMyOrganization, getQuest, getQuestCheckpoints, readApiError, type Organization, type Quest } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";
import { FundingPanel } from "./funding-panel";

type Mode = "BOUNTY" | "FRIENDS";
type SelectionMethod = "FIRST_VALID" | "BEST_SUBMISSION" | "ROOM_VOTE";
type Visibility = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
type Stop = { title: string; instructions: string; latitude: number | null; longitude: number | null; radius: number };
type FriendGroup = { id: string; name: string; member_count: number };

const steps = ["Mode", "Quest", "People", "Proof", "Winners", "Reward", "Review"] as const;
const MAX_ENTRIES = 7;
const proofOptions = [
  { value: "PHOTO", label: "Photo", hint: "1 in-app photo", icon: Camera },
  { value: "VIDEO", label: "Video", hint: "Up to 15 seconds", icon: Video },
  { value: "LINK", label: "Link", hint: "Work hosted elsewhere", icon: Link2 },
  { value: "TEXT", label: "Short text", hint: "A line or two", icon: FileText },
  { value: "LOCATION", label: "Location", hint: "Check in at the place", icon: MapPin },
] as const;
const emptyStop = (): Stop => ({ title: "", instructions: "", latitude: null, longitude: null, radius: 75 });

function locate() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not available in this browser."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error("Allow location access, then try again.")),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 },
    );
  });
}

export default function CreateQuestPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("BOUNTY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [isGroup, setIsGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  const [groupInstructions, setGroupInstructions] = useState("");
  const [maxEntries, setMaxEntries] = useState(MAX_ENTRIES);
  const [proof, setProof] = useState<string[]>(["PHOTO"]);
  const [hunt, setHunt] = useState(false);
  const [huntOrdered, setHuntOrdered] = useState(true);
  const [stops, setStops] = useState<Stop[]>([emptyStop(), emptyStop()]);
  const [locatingStop, setLocatingStop] = useState<number | null>(null);
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>("FIRST_VALID");
  const [judgingCriteria, setJudgingCriteria] = useState("");
  const [winners, setWinners] = useState(1);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(10);
  const [stake, setStake] = useState("");
  const [audience, setAudience] = useState<"ALL_FRIENDS" | "GROUP" | "LINK">("ALL_FRIENDS");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedQuest, setPublishedQuest] = useState<Quest | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [storedCoverUrl, setStoredCoverUrl] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [asOrganization, setAsOrganization] = useState(false);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [savedStopIds, setSavedStopIds] = useState<string[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [viewerName, setViewerName] = useState("You");

  useEffect(() => {
    let active = true;
    void createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        router.replace(`/auth?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
        return;
      }
      setCheckingAuth(false);
      const metadata = session.user.user_metadata as { full_name?: string; name?: string };
      setViewerName(metadata.full_name ?? metadata.name ?? "You");
      void getMyOrganization(session.access_token).then((value) => { if (active) setOrganization(value); }).catch(() => undefined);
      void fetch(apiUrl("/friends/groups"), { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" })
        .then(async (response) => { if (active && response.ok) setFriendGroups(await response.json() as FriendGroup[]); })
        .catch(() => undefined);

      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "friends") chooseMode("FRIENDS");
      const presetGroup = params.get("group");
      if (presetGroup) { setAudience("GROUP"); setGroupId(presetGroup); }
      const questId = params.get("edit");
      if (!questId) return;
      setLoadingDraft(true);
      try {
        const [draft, savedStops] = await Promise.all([getQuest(questId, session.access_token), getQuestCheckpoints(questId, session.access_token)]);
        if (!draft || draft.creator_id !== session.user.id || draft.status !== "DRAFT") throw new Error("Only your unpublished drafts can be edited.");
        if (!active) return;
        setEditingQuestId(draft.id);
        setMode(draft.quest_type);
        setTitle(draft.title);
        setDescription(draft.description);
        setVisibility(draft.visibility);
        setIsGroup(draft.is_group_challenge);
        setGroupSize(draft.required_group_size ?? 2);
        setGroupInstructions(draft.group_instructions ?? "");
        setMaxEntries(Math.min(MAX_ENTRIES, draft.max_entries));
        setProof(draft.proof_requirements.filter((value) => value !== "QR_CHECKPOINT"));
        setSelectionMethod(draft.winner_selection_method as SelectionMethod);
        setJudgingCriteria(draft.judging_criteria ?? "");
        setWinners(draft.winner_count);
        setRewardEnabled(draft.reward_enabled);
        setRewardAmount(draft.reward_amount_minor ? draft.reward_amount_minor / 100_000 : 10);
        setStake(draft.friendly_stake ?? "");
        setLocationName(draft.location_name ?? "");
        setLatitude(draft.latitude);
        setLongitude(draft.longitude);
        setStoredCoverUrl(draft.cover_media_url);
        setCoverPreview(draft.cover_media_url);
        setAsOrganization(Boolean(draft.organization_id));
        setHuntOrdered(draft.hunt_ordered);
        const local = new Date(draft.deadline);
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        setDeadline(local.toISOString().slice(0, 16));
        if (savedStops.length) {
          setHunt(true);
          setSavedStopIds(savedStops.map((stop) => stop.id));
          setStops(savedStops.map((stop) => ({ title: stop.title, instructions: stop.instructions ?? "", latitude: stop.latitude, longitude: stop.longitude, radius: stop.radius_m })));
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "This draft could not be loaded.");
      } finally {
        if (active) setLoadingDraft(false);
      }
    });
    return () => { active = false; };
  }, [router]);

  function chooseMode(value: Mode) {
    setMode(value);
    if (value === "FRIENDS") {
      setVisibility("INVITE_ONLY");
      setRewardEnabled(false);
      setSelectionMethod("ROOM_VOTE");
      setAsOrganization(false);
    } else {
      setVisibility("PUBLIC");
      setSelectionMethod("FIRST_VALID");
      setStake("");
    }
  }

  const friends = mode === "FRIENDS";
  const deadlineValid = Boolean(deadline) && new Date(deadline).getTime() > Date.now();
  const detailsValid = title.trim().length >= 3 && description.trim().length >= 1 && deadlineValid;
  const locationReady = locationName.trim().length >= 2 && latitude !== null && longitude !== null;
  const stopsReady = !hunt || (stops.length >= 2 && stops.length <= 8 && stops.every((stop) => stop.title.trim().length >= 2 && (!stop.instructions.trim() || stop.instructions.trim().length >= 2)));
  const proofRequirements = useMemo(() => [...proof, ...(hunt ? ["QR_CHECKPOINT"] : [])], [proof, hunt]);
  const totalFunding = useMemo(() => Math.round(rewardAmount * winners * 100_000) / 100_000, [rewardAmount, winners]);
  const stakeValid = !stake.trim() || (stake.trim().length >= 2 && stake.trim().length <= 120);

  const stepValid = [
    true,
    detailsValid && (!proof.includes("LOCATION") || locationReady),
    (!isGroup || groupInstructions.trim().length >= 3) && (!friends || audience !== "GROUP" || Boolean(groupId)),
    proofRequirements.length > 0 && stopsReady && (!proof.includes("LOCATION") || locationReady),
    selectionMethod !== "BEST_SUBMISSION" || judgingCriteria.trim().length >= 3,
    friends ? stakeValid : !rewardEnabled || rewardAmount > 0,
    true,
  ];
  const allValid = stepValid.every(Boolean);

  const summary = [
    friends ? "Friends challenge" : "Bounty",
    title.trim() || "Untitled",
    friends ? (audience === "GROUP" ? friendGroups.find((group) => group.id === groupId)?.name ?? "One group" : audience === "ALL_FRIENDS" ? "All friends" : "Invite link") : `${visibility === "PUBLIC" ? "Public" : "Private"} · max ${maxEntries}`,
    `${proofRequirements.filter((value) => value !== "QR_CHECKPOINT").map((value) => proofOptions.find((option) => option.value === value)?.label ?? value).join(", ")}${hunt ? " · hunt on" : ""}`,
    `${winners} · ${selectionMethod === "ROOM_VOTE" ? "room vote" : selectionMethod === "FIRST_VALID" ? "first valid" : "best submission"}`,
    friends ? stake.trim() || "Bragging rights" : rewardEnabled ? `${rewardAmount} NIM each` : "Recognition",
    "",
  ];

  function toggleProof(value: string) {
    setProof((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function updateStop(index: number, patch: Partial<Stop>) {
    setStops((current) => current.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop));
  }

  async function pinStop(index: number) {
    setLocatingStop(index);
    setError(null);
    try {
      const position = await locate();
      updateStop(index, position);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not get your location.");
    } finally {
      setLocatingStop(null);
    }
  }

  async function pinQuestLocation() {
    setLocating(true);
    setError(null);
    try {
      const position = await locate();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not get your location.");
    } finally {
      setLocating(false);
    }
  }

  function chooseCover(file: File | null) {
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : storedCoverUrl);
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    const supabase = createClient();
    let uploadedCoverPath: string | null = null;
    let draftCreated = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/auth?next=/create");
      const authorized = { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };

      let coverMediaUrl = storedCoverUrl;
      if (coverFile) {
        if (coverFile.size > 10 * 1024 * 1024) throw new Error("Cover images cannot exceed 10 MB.");
        const extension = coverFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
        uploadedCoverPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("quest-covers").upload(uploadedCoverPath, coverFile, { contentType: coverFile.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        coverMediaUrl = supabase.storage.from("quest-covers").getPublicUrl(uploadedCoverPath).data.publicUrl;
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        organization_id: asOrganization && !friends ? organization?.id ?? null : null,
        cover_media_url: coverMediaUrl,
        location_name: locationReady ? locationName.trim() : null,
        latitude: locationReady ? latitude : null,
        longitude: locationReady ? longitude : null,
        quest_type: mode,
        visibility: friends ? "INVITE_ONLY" : visibility,
        is_group_challenge: isGroup,
        required_group_size: isGroup ? groupSize : null,
        group_instructions: isGroup ? groupInstructions.trim() : null,
        max_entries: maxEntries,
        winner_count: Math.min(winners, maxEntries),
        winner_selection_method: selectionMethod,
        proof_requirements: proofRequirements,
        judging_criteria: selectionMethod === "BEST_SUBMISSION" ? judgingCriteria.trim() : null,
        reward_enabled: !friends && rewardEnabled,
        reward_amount_minor: !friends && rewardEnabled ? Math.round(rewardAmount * 100_000) : null,
        reward_currency: !friends && rewardEnabled ? "NIM" : null,
        settlement_asset: !friends && rewardEnabled ? "NIM" : null,
        deadline: new Date(deadline).toISOString(),
        hunt_ordered: huntOrdered,
        friendly_stake: friends && stake.trim() ? stake.trim() : null,
        audience: friends ? audience : null,
        group_id: friends && audience === "GROUP" ? groupId : null,
      };
      const createdResponse = await fetch(apiUrl(editingQuestId ? `/quests/${editingQuestId}` : "/quests"), { method: editingQuestId ? "PATCH" : "POST", headers: authorized, body: JSON.stringify(payload) });
      if (!createdResponse.ok) throw new Error(await readApiError(createdResponse, "The quest could not be saved."));
      const created = await createdResponse.json() as Quest;
      draftCreated = true;

      for (const stopId of savedStopIds) {
        const response = await fetch(apiUrl(`/quests/${created.id}/checkpoints/${stopId}`), { method: "DELETE", headers: { Authorization: authorized.Authorization } });
        if (!response.ok) throw new Error(await readApiError(response, "The saved stops could not be updated."));
      }
      if (hunt) {
        for (const stop of stops) {
          const response = await fetch(apiUrl(`/quests/${created.id}/checkpoints`), {
            method: "POST",
            headers: authorized,
            body: JSON.stringify({ title: stop.title.trim(), instructions: stop.instructions.trim() || null, latitude: stop.latitude, longitude: stop.longitude, radius_m: stop.latitude !== null ? stop.radius : null }),
          });
          if (!response.ok) throw new Error(await readApiError(response, "A hunt stop could not be added."));
        }
      }

      const publishResponse = await fetch(apiUrl(`/quests/${created.id}/publish`), { method: "POST", headers: { Authorization: authorized.Authorization } });
      if (!publishResponse.ok) throw new Error(await readApiError(publishResponse, "The quest draft could not be published."));
      const published = await publishResponse.json() as Quest;
      setPublishedQuest(published);
      if (published.status === "OPEN") router.push(`/quests/${published.id}/share`);
    } catch (caught) {
      if (uploadedCoverPath && !draftCreated) await supabase.storage.from("quest-covers").remove([uploadedCoverPath]);
      setError(caught instanceof Error ? caught.message : "The quest could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  if (checkingAuth) {
    return <main className="grid min-h-screen place-items-center bg-bg"><div role="status" className="flex items-center gap-3 text-sm font-semibold text-ink-2"><LoaderCircle size={19} className="animate-spin" aria-hidden="true" />Checking your account…</div></main>;
  }

  const option = (selected: boolean) => `relative flex flex-col gap-3 rounded-[20px] border-2 p-[18px] text-left transition ${selected ? "border-inv bg-lime-tint" : "border-line bg-surface hover:border-ink-3"}`;

  return (
    <AppShell active="create" viewer={{ displayName: viewerName }}>
      <div className="px-4 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-9">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[15px] font-medium text-ink-2">{editingQuestId ? "Editing your draft" : "New quest"}</span>
              <h1 className="sq-display text-[44px] !leading-none !tracking-[-0.04em]">Create a quest</h1>
            </div>
            <Link href="/quests" className="text-sm font-semibold">Exit to My quests</Link>
          </div>

          <div className="flex flex-wrap items-start gap-8">
            <section aria-busy={loadingDraft} className="flex min-w-0 flex-[999_1_520px] flex-wrap overflow-hidden rounded-[28px] border border-line bg-surface">
              <nav aria-label="Create steps" className="flex-[1_1_180px] border-b border-line px-4 py-6 md:border-b-0 md:border-r">
                <span className="block px-2 pb-2 text-[13px] text-ink-2">Step {step + 1} of {steps.length}</span>
                <div aria-hidden="true" className="flex gap-[3px] px-2 pb-3.5">{steps.map((name, index) => <span key={name} className={`h-1 flex-1 rounded-sm ${index <= step ? "bg-inv" : "bg-line"}`} />)}</div>
                <ol className="flex gap-1 overflow-x-auto md:flex-col">
                  {steps.map((name, index) => {
                    const done = index < step;
                    const current = index === step;
                    return (
                      <li key={name}>
                        <button type="button" onClick={() => index <= step && setStep(index)} disabled={index > step} aria-current={current ? "step" : undefined} className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-2 py-2.5 text-left text-sm font-semibold ${current ? "bg-sunken" : ""} ${index > step ? "text-ink-3" : ""}`}>
                          <span className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-xs font-bold ${done ? "bg-lime text-on-lime" : current ? "border-2 border-inv bg-surface" : "border border-line"}`}>{done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : index + 1}</span>
                          <span className="flex min-w-0 flex-col"><span>{name}</span>{done && summary[index] ? <span className="max-w-[140px] truncate text-xs font-medium text-ink-2">{summary[index]}</span> : null}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="flex min-w-0 flex-[999_1_340px] flex-col gap-6 p-6 sm:p-7">
                {step === 0 ? (
                  <fieldset className="flex flex-col gap-4">
                    <legend className="flex flex-col gap-1 pb-3"><span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Mode</span><span className="font-display text-[28px] font-black uppercase leading-none tracking-[-0.03em]">Who is this quest for?</span></legend>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                      <button type="button" aria-pressed={mode === "BOUNTY"} onClick={() => chooseMode("BOUNTY")} className={option(mode === "BOUNTY")}>
                        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-lime text-on-lime"><Trophy size={22} aria-hidden="true" /></span>
                        <span className="flex flex-col gap-1"><span className="text-lg font-bold">Bounty</span><span className="text-sm leading-snug text-ink-2">Public, or private by link. Shows on Discover, Map and Quest Radar.</span></span>
                        <span className="flex flex-wrap gap-1.5">{["Up to 7 entries", "1 to 3 winners", "NIM or recognition"].map((tag) => <span key={tag} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{tag}</span>)}</span>
                      </button>
                      <button type="button" aria-pressed={friends} onClick={() => chooseMode("FRIENDS")} className={option(friends)}>
                        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-coral-tint text-[#B23A1C]"><UsersRound size={22} aria-hidden="true" /></span>
                        <span className="flex flex-col gap-1"><span className="text-lg font-bold">Friends challenge</span><span className="text-sm leading-snug text-ink-2">Private. Send to all your friends, one friend group, or by invite link.</span></span>
                        <span className="flex flex-wrap gap-1.5">{["Room vote", "Bragging rights or a stake", "No money"].map((tag) => <span key={tag} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{tag}</span>)}</span>
                      </button>
                    </div>
                    {!friends && organization ? (
                      <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-line p-4">
                        <input type="checkbox" checked={asOrganization} onChange={(event) => setAsOrganization(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--inv)]" />
                        <span><strong className="block text-sm">Publish as {organization.display_name}</strong><span className="mt-1 block text-xs leading-5 text-ink-2">The organization badge shows on this bounty while you stay its accountable creator.</span></span>
                      </label>
                    ) : null}
                  </fieldset>
                ) : null}

                {step === 1 ? (
                  <div className="flex flex-col gap-5">
                    <StepTitle title="What's the side quest?" body="Make it sound like something people would actually want to try." />
                    <Field label="Quest title"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="sq-input" placeholder={friends ? "Same meal, four kitchens" : "Lekki sunset trail"} /></Field>
                    <Field label="What should people do?"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} className="sq-input resize-none" placeholder="Give people a clear, fun challenge." /></Field>
                    <Field label="Deadline" hint="Uses your current timezone. Rules lock when the quest is published.">
                      <span className="flex items-center gap-3 rounded-full border border-line bg-surface px-4"><CalendarDays size={18} className="text-ink-3" aria-hidden="true" /><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="min-h-[52px] w-full bg-transparent outline-none" /></span>
                    </Field>
                    <div className="flex flex-col gap-3 rounded-[20px] border border-line p-4">
                      <Field label={<>Place <span className="font-normal text-ink-2">(optional, shows on the map)</span></>}><input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={120} className="sq-input" placeholder="Café Neo, Lekki Phase 1" /></Field>
                      <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={pinQuestLocation} disabled={locating} className="sq-btn sq-btn-ghost !min-h-11 !text-[11px]">{locating ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}{latitude === null ? "Use current location" : "Update pin"}</button>{latitude !== null ? <span className="text-xs font-semibold text-ink-2">Pin added</span> : null}</div>
                    </div>
                    <label className="flex min-h-[120px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[20px] border-2 border-dashed border-line bg-cover bg-center text-sm font-semibold text-ink-2" style={coverPreview ? { backgroundImage: `linear-gradient(rgba(17,17,17,.5),rgba(17,17,17,.5)),url(${JSON.stringify(coverPreview)})`, color: "white" } : undefined}><ImagePlus size={19} aria-hidden="true" />{coverPreview ? "Change cover image" : "Add a cover image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseCover(event.target.files?.[0] ?? null)} /></label>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="flex flex-col gap-6">
                    <StepTitle title="Who can take part?" body={friends ? "Friends challenges never appear on Discover. Only the people you send it to can see it." : "Joining is free. A spot is used only when a valid entry is accepted."} />
                    {friends ? (
                      <fieldset className="flex flex-col gap-3">
                        <legend className="sq-field-label pb-3">Send to</legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {([["ALL_FRIENDS", "All friends", "Everyone you're friends with"], ["GROUP", "One group", "A friend group room"], ["LINK", "Invite link", "Anyone you send the link to"]] as const).map(([value, label, hint]) => (
                            <button key={value} type="button" aria-pressed={audience === value} onClick={() => setAudience(value)} className={option(audience === value)}><span className="font-bold">{label}</span><span className="text-xs leading-5 text-ink-2">{hint}</span></button>
                          ))}
                        </div>
                        {audience === "GROUP" ? (
                          friendGroups.length ? (
                            <div className="flex flex-wrap gap-2">{friendGroups.map((group) => <button key={group.id} type="button" aria-pressed={groupId === group.id} onClick={() => setGroupId(group.id)} className="sq-chip">{group.name} · {group.member_count}</button>)}</div>
                          ) : <p className="rounded-2xl bg-sunken p-4 text-sm text-ink-2">You are not in any friend groups yet. <Link href="/friends" className="font-bold underline">Start one in Friends</Link>.</p>
                        ) : null}
                      </fieldset>
                    ) : (
                      <fieldset className="flex flex-col gap-3">
                        <legend className="sq-field-label pb-3">Who can see it</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button type="button" aria-pressed={visibility === "PUBLIC"} onClick={() => setVisibility("PUBLIC")} className={option(visibility === "PUBLIC")}><span className="font-bold">Public</span><span className="text-xs leading-5 text-ink-2">On Discover, Map and Quest Radar</span></button>
                          <button type="button" aria-pressed={visibility !== "PUBLIC"} onClick={() => setVisibility("INVITE_ONLY")} className={option(visibility !== "PUBLIC")}><span className="font-bold">Private by link</span><span className="text-xs leading-5 text-ink-2">Only people with your link or QR</span></button>
                        </div>
                      </fieldset>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" aria-pressed={!isGroup} onClick={() => setIsGroup(false)} className={option(!isGroup)}><span className="font-bold">Solo entries</span><span className="text-xs leading-5 text-ink-2">One person, one entry.</span></button>
                      <button type="button" aria-pressed={isGroup} onClick={() => setIsGroup(true)} className={option(isGroup)}><span className="flex items-center gap-2 font-bold"><UsersRound size={17} aria-hidden="true" />Group entries</span><span className="text-xs leading-5 text-ink-2">One person submits for the whole group.</span></button>
                    </div>
                    {isGroup ? (
                      <div className="flex flex-col gap-4">
                        <Field label="People per group, including the submitter"><input type="number" min={2} max={50} value={groupSize} onChange={(event) => setGroupSize(Math.min(50, Math.max(2, Number(event.target.value) || 2)))} className="sq-input" /></Field>
                        <Field label="Group instructions"><textarea value={groupInstructions} onChange={(event) => setGroupInstructions(event.target.value)} maxLength={500} rows={3} className="sq-input resize-none" placeholder="Who should be in the group and what everyone does together." /></Field>
                      </div>
                    ) : null}
                    {!friends ? (
                      <fieldset className="flex flex-col gap-3">
                        <legend className="sq-field-label pb-3">Maximum official entries</legend>
                        <div className="flex flex-wrap gap-2">{Array.from({ length: MAX_ENTRIES }, (_, index) => index + 1).map((count) => <button key={count} type="button" aria-pressed={maxEntries === count} onClick={() => { setMaxEntries(count); setWinners((value) => Math.min(value, count)); }} className="sq-chip !w-12 justify-center !px-0 font-mono">{count}</button>)}</div>
                        <span className="text-xs text-ink-3">A bounty accepts at most 7 official entries.</span>
                      </fieldset>
                    ) : null}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="flex flex-col gap-5">
                    <StepTitle title="How will people prove it?" body="Pick one or more. Proof is captured inside SideQuest, so photos come stamped with time and place." />
                    <fieldset className="flex flex-col gap-2.5">
                      <legend className="sq-field-label pb-2.5">Proof type</legend>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
                        {proofOptions.map(({ value, label, hint, icon: Icon }) => {
                          const selected = proof.includes(value);
                          return (
                            <button key={value} type="button" aria-pressed={selected} onClick={() => toggleProof(value)} className={`relative flex flex-col gap-2.5 rounded-[18px] border-2 p-3.5 text-left ${selected ? "border-inv bg-lime-tint" : "border-line"}`}>
                              {selected ? <Check size={16} strokeWidth={3} className="absolute right-3 top-3" aria-hidden="true" /> : null}
                              <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? "bg-surface" : "bg-sunken text-ink-2"}`}><Icon size={18} aria-hidden="true" /></span>
                              <span className="text-[15px] font-semibold">{label}</span>
                              <span className="text-xs text-ink-2">{hint}</span>
                            </button>
                          );
                        })}
                      </div>
                      {proof.includes("LOCATION") && !locationReady ? <p className="rounded-2xl bg-lime-tint p-3 text-sm">Location proof needs a place name and pin. Add them on the Quest step.</p> : null}
                    </fieldset>
                    <div className="overflow-hidden rounded-[20px] border border-line">
                      <label className="flex cursor-pointer items-center justify-between gap-4 p-4">
                        <span className="flex items-center gap-3"><span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-lime-tint"><Route size={20} aria-hidden="true" /></span><span className="flex flex-col gap-0.5"><span className="text-base font-bold">Make it a hunt</span><span className="text-[13px] text-ink-2">2 to 8 stops, each with a hint and a private QR code</span></span></span>
                        <Switch checked={hunt} onChange={setHunt} label="Make it a hunt" />
                      </label>
                      {hunt ? (
                        <div className="flex flex-col gap-3 border-t border-line p-[18px]">
                          <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="text-base font-bold">Hunt stops</h3><span className="text-[13px] text-ink-2">{stops.length} of 8 stops</span></div>
                          <ol className="flex flex-col gap-2">
                            {stops.map((stop, index) => (
                              <li key={index} className="flex items-start gap-3 rounded-[18px] border border-line p-3">
                                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-lime font-mono text-xs font-bold text-on-lime">{index + 1}</span>
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                  <label className="flex flex-col gap-0.5"><span className="text-xs text-ink-3">Stop {index + 1} name</span><input value={stop.title} onChange={(event) => updateStop(index, { title: event.target.value })} maxLength={100} className="bg-transparent text-[15px] font-semibold outline-none" placeholder="Boardwalk gate" /></label>
                                  <label className="flex flex-col gap-0.5"><span className="text-xs text-ink-3">Hint for hunters</span><input value={stop.instructions} onChange={(event) => updateStop(index, { instructions: event.target.value })} maxLength={500} className="bg-transparent text-sm outline-none" placeholder="QR on the gate post" /></label>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={() => pinStop(index)} disabled={locatingStop === index} className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-bold">{locatingStop === index ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}{stop.latitude === null ? "Pin this stop here" : "Pinned"}</button>
                                    {stop.latitude !== null ? <label className="flex items-center gap-1.5 text-xs text-ink-2">Zone<select value={stop.radius} onChange={(event) => updateStop(index, { radius: Number(event.target.value) })} className="rounded-full border border-line bg-surface px-2 py-1 text-xs">{[50, 75, 100, 150, 250].map((radius) => <option key={radius} value={radius}>{radius} m</option>)}</select></label> : <span className="text-xs text-ink-3">Unpinned stops check only the QR code.</span>}
                                  </div>
                                </div>
                                <button type="button" onClick={() => setStops((current) => current.filter((_, stopIndex) => stopIndex !== index))} disabled={stops.length <= 2} aria-label={`Remove stop ${index + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:text-danger disabled:opacity-25"><Trash2 size={15} aria-hidden="true" /></button>
                              </li>
                            ))}
                          </ol>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button type="button" onClick={() => setStops((current) => [...current, emptyStop()])} disabled={stops.length >= 8} className="sq-btn sq-btn-ghost !min-h-11 !text-[11px]"><Plus size={15} aria-hidden="true" />Add stop</button>
                            <label className="flex items-center gap-2 text-sm font-semibold">Stops in order<Switch checked={huntOrdered} onChange={setHuntOrdered} label="Stops must be found in order" /></label>
                          </div>
                          <span className="flex items-center gap-1.5 text-xs text-ink-3"><QrCode size={13} aria-hidden="true" />Private QR codes are created when you publish. Print them from the quest page.</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="flex flex-col gap-5">
                    <StepTitle title="How are winners picked?" body={friends ? "Everyone in the room gets one vote. Nobody can vote for themselves, and votes stay hidden until voting closes." : "Rules lock when you publish, so pick carefully."} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(friends ? (["ROOM_VOTE", "FIRST_VALID"] as const) : (["FIRST_VALID", "BEST_SUBMISSION"] as const)).map((method) => (
                        <button key={method} type="button" aria-pressed={selectionMethod === method} onClick={() => setSelectionMethod(method)} className={option(selectionMethod === method)}>
                          <span className="font-bold">{method === "ROOM_VOTE" ? "Room vote" : method === "FIRST_VALID" ? (friends ? "Race: first valid wins" : "First valid") : "Best submission"}</span>
                          <span className="text-sm leading-snug text-ink-2">{method === "ROOM_VOTE" ? "Needs at least 2 entries and 2 votes. Ties share the win." : method === "FIRST_VALID" ? "The earliest valid entries win, by server time." : "You judge valid entries against criteria you publish now."}</span>
                        </button>
                      ))}
                    </div>
                    {selectionMethod === "BEST_SUBMISSION" ? <Field label="Published judging criteria"><textarea value={judgingCriteria} onChange={(event) => setJudgingCriteria(event.target.value)} maxLength={500} rows={3} className="sq-input resize-none" placeholder="Originality, composition, and how closely it follows the brief." /></Field> : null}
                    <fieldset className="flex flex-col gap-3">
                      <legend className="sq-field-label pb-3">Number of winners</legend>
                      <div className="flex gap-2">{[1, 2, 3].filter((count) => count <= maxEntries).map((count) => <button key={count} type="button" aria-pressed={winners === count} onClick={() => setWinners(count)} className="sq-chip !w-14 justify-center !px-0 font-mono">{count}</button>)}</div>
                    </fieldset>
                  </div>
                ) : null}

                {step === 5 ? (
                  friends ? (
                    <div className="flex flex-col gap-5">
                      <StepTitle title="What's at stake?" body="No money between friends. Add a friendly stake if you like, or play for bragging rights and a badge." />
                      <Field label={<>Friendly stake <span className="font-normal text-ink-2">(optional)</span></>} hint="Text only, up to 120 characters."><input value={stake} onChange={(event) => setStake(event.target.value)} maxLength={120} className="sq-input" placeholder="Loser buys suya" /></Field>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                      <StepTitle title="Is there a reward?" body="NIM rewards are held by SideQuest and paid to winners automatically. Unused NIM comes back to you." />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" aria-pressed={!rewardEnabled} onClick={() => setRewardEnabled(false)} className={option(!rewardEnabled)}><span className="font-bold">Recognition only</span><span className="text-sm text-ink-2">Bragging rights and a badge.</span></button>
                        <button type="button" aria-pressed={rewardEnabled} onClick={() => setRewardEnabled(true)} className={option(rewardEnabled)}><span className="font-bold">NIM per winner</span><span className="text-sm text-ink-2">Funded and verified on Nimiq testnet.</span></button>
                      </div>
                      {rewardEnabled ? (
                        <div className="flex flex-col gap-4 rounded-[20px] bg-sunken p-5">
                          <Field label="NIM per winner"><input type="number" min={0.00001} step={0.00001} value={rewardAmount} onChange={(event) => setRewardAmount(Math.max(0.00001, Number(event.target.value) || 0.00001))} className="sq-input font-mono text-lg font-bold" /></Field>
                          <div className="flex items-center justify-between border-t border-line pt-4"><span className="text-sm text-ink-2">{winners} winner{winners > 1 ? "s" : ""}</span><span className="font-display text-2xl font-black">{totalFunding} NIM total</span></div>
                          <p className="text-xs text-ink-2">The bounty opens once the funding payment is verified. Testnet NIM has no cash value.</p>
                        </div>
                      ) : null}
                    </div>
                  )
                ) : null}

                {step === 6 ? (
                  <div className="flex flex-col gap-5">
                    <StepTitle title="Ready to publish?" body={friends ? "We'll send it to your friends and take you to the share link." : "You'll get a short link and a QR code to share right after."} />
                    <dl className="divide-y divide-line rounded-[20px] border border-line">
                      {[["Mode", friends ? "Friends challenge" : "Bounty"], ["Quest", title || "Untitled"], ["Deadline", deadline ? new Date(deadline).toLocaleString() : "Not set"], ["People", summary[2]], ["Proof", summary[3]], ...(hunt ? [["Hunt", `${stops.length} stops · ${huntOrdered ? "in order" : "any order"}`]] : []), ["Winners", summary[4]], [friends ? "Stake" : "Reward", summary[5]], ...(rewardEnabled && !friends ? [["To fund", `${totalFunding} NIM`]] : [])].map(([label, value]) => (
                        <div key={label} className="flex items-start justify-between gap-6 px-4 py-3.5"><dt className="text-sm text-ink-2">{label}</dt><dd className="max-w-[65%] text-right text-sm font-bold">{value}</dd></div>
                      ))}
                    </dl>
                    {publishedQuest?.status === "AWAITING_FUNDING" ? <><div className="flex items-start gap-3 rounded-[20px] bg-lime-tint p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime text-on-lime"><Check size={16} aria-hidden="true" /></span><p className="text-sm leading-6"><strong>Saved.</strong> Fund the reward pool to open this bounty.</p></div><FundingPanel questId={publishedQuest.id} /></> : null}
                  </div>
                ) : null}

                {error ? <p role="alert" className="rounded-[18px] border border-danger/30 p-4 text-sm leading-6 text-danger">{error}</p> : null}

                <div className="mt-auto flex items-center justify-between border-t border-line pt-5">
                  <button type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} className="flex items-center gap-2 rounded-full px-3 py-3 text-sm font-bold disabled:opacity-30"><ArrowLeft size={17} aria-hidden="true" />Back</button>
                  {step < steps.length - 1 ? (
                    <button type="button" onClick={() => setStep((value) => value + 1)} disabled={!stepValid[step]} className="sq-btn sq-btn-lime">Continue<ArrowRight size={17} aria-hidden="true" /></button>
                  ) : (
                    <button type="button" onClick={publish} disabled={publishing || !allValid || Boolean(publishedQuest)} className="sq-btn sq-btn-lime">{publishing ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />Publishing…</> : rewardEnabled && !friends ? "Save and fund" : friends ? "Send challenge" : "Publish quest"}</button>
                  )}
                </div>
              </div>
            </section>

            <aside className="hidden flex-[1_1_300px] lg:block">
              <div className="sticky top-8 flex flex-col gap-3">
                <span className="sq-label text-ink-3">Preview</span>
                <div className="relative rounded-[26px] border border-line bg-surface shadow-[var(--shadow-card)]">
                  <span className="relative block h-[260px] overflow-hidden rounded-t-[25px] bg-sunken">
                    {coverPreview ? <img src={coverPreview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <img src={friends ? "/art/cover-four-kitchens.svg" : hunt ? "/art/cover-lekki-sunset.svg" : "/art/cover-ire-market.svg"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
                    <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0)_45%,rgba(17,17,17,0.85)_100%)]" />
                    <span className="absolute inset-x-5 bottom-[18px] font-display text-[28px] font-black uppercase leading-[0.86] tracking-[-0.05em] text-white">{title || "Your quest title"}</span>
                  </span>
                  <span className={`sq-sticker absolute -top-3 left-5 -rotate-6 ${friends ? "sq-sticker-coral" : "sq-sticker-lime"}`}>{friends ? "Friends" : hunt ? `Hunt · ${stops.length} stops` : "Bounty"}</span>
                  <span className="sq-ticket-tear flex items-end justify-between px-[22px] pb-4 pt-3.5">
                    <span className="flex flex-col gap-1.5"><span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink-3">{friends ? "Stake" : "Reward"}</span><span className="font-display text-2xl font-black uppercase leading-[0.86]">{friends ? stake.trim() || "Glory" : rewardEnabled ? `${rewardAmount} NIM` : "Glory"}</span></span>
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink-3">{friends ? "Room vote" : `${maxEntries} spots`}</span>
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StepTitle({ title, body }: { title: string; body: string }) {
  return <div className="flex flex-col gap-1.5"><h2 className="font-display text-[28px] font-black uppercase leading-none tracking-[-0.03em]">{title}</h2><p className="text-[15px] leading-snug text-ink-2">{body}</p></div>;
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="sq-field-label">{label}</span>{children}{hint ? <span className="text-xs text-ink-3">{hint}</span> : null}</label>;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <span className="relative h-7 w-12 flex-none">
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0" />
      <span aria-hidden="true" className={`absolute inset-0 rounded-full transition ${checked ? "bg-lime" : "bg-line"}`} />
      <span aria-hidden="true" className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-inv transition-all ${checked ? "left-[23px]" : "left-[3px]"}`} />
    </span>
  );
}
