import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Map as MapIcon, Share2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { QrCode } from "@/components/qr-code";
import { ReportContentButton } from "@/components/report-content-button";
import { formatCountdown, getQuest, getQuestCheckpoints, getQuestSaved, getQuestWinners, isHunt, questCover, rewardAmount, type Quest } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { displayShareUrl, questShareUrl } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";
import { CheckpointPanel } from "./checkpoint-panel";
import { InvitationPanel } from "./invitation-panel";
import { JoinButton } from "./join-button";
import { SaveQuestButton } from "./save-quest-button";

type QuestPageProps = { params: Promise<{ id: string }> };

export default function QuestPage(props: QuestPageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><QuestExperience {...props} /></Suspense>;
}

const proofLabels: Record<string, string> = { PHOTO: "Photo", VIDEO: "Video", TEXT: "Short note", LOCATION: "Location check-in", LINK: "Link", QR_CHECKPOINT: "QR stops" };

function deadlineLabel(deadline: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(deadline));
}

async function QuestExperience({ params }: QuestPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [quest, viewer, winners, checkpoints] = await Promise.all([
    getQuest(id, session?.access_token),
    getViewer(),
    getQuestWinners(id),
    getQuestCheckpoints(id, session?.access_token),
  ]);
  if (!quest) notFound();
  const initiallySaved = session ? await getQuestSaved(id, session.access_token) : false;

  const isCreator = viewer?.id === quest.creator_id;
  const isOpen = quest.status === "OPEN";
  const hunt = isHunt(quest);
  const friends = quest.quest_type === "FRIENDS";
  const used = Math.min(quest.entries_received, quest.max_entries);
  const left = Math.max(0, quest.max_entries - used);
  const reward = rewardAmount(quest);
  const host = quest.organization_display_name ?? quest.creator_display_name;
  const hostHref = quest.organization_slug ? `/businesses/${quest.organization_slug}` : `/users/${quest.creator_username}`;
  const shareUrl = questShareUrl(quest.short_code, quest.id);
  const rulesLine = quest.winner_selection_method === "FIRST_VALID" ? `First ${quest.winner_count} valid entr${quest.winner_count === 1 ? "y wins" : "ies win"}, by server time.` : `The best ${quest.winner_count === 1 ? "entry wins" : `${quest.winner_count} entries win`}, judged by ${host} against the published criteria.`;
  const marquee = [isOpen ? "Live" : quest.status.replaceAll("_", " "), `${left} spots left`, reward ? `${reward} × ${quest.winner_count} winner${quest.winner_count === 1 ? "" : "s"}` : "Bragging rights", quest.winner_selection_method === "FIRST_VALID" ? "First valid wins" : "Best entry wins", `Ends in ${formatCountdown(quest.deadline)}`, hunt ? `${quest.checkpoint_count} QR stops` : null, host].filter(Boolean) as string[];

  return (
    <AppShell active={friends ? "friends" : "discover"} viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username } : null}>
      <div className="overflow-hidden px-4 pb-16 pt-6 sm:px-8 lg:px-11 lg:pt-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
            <Link href={friends ? "/friends" : "/discover"} className="inline-flex min-h-11 items-center gap-1.5 text-ink"><ArrowLeft size={14} aria-hidden="true" />{friends ? "Friends" : "Discover"}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="truncate">{quest.title}</span>
          </nav>

          <div className="flex flex-wrap items-start gap-11">
            <section aria-labelledby="quest-h" className="flex min-w-0 flex-[999_1_520px] flex-col gap-[30px]">
              <div className="flex flex-wrap items-end gap-7">
                <div className="relative aspect-[4/5] max-w-[460px] flex-[1_1_340px]">
                  <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-sunken shadow-[0_24px_50px_rgba(17,17,17,0.16)]">
                    <img src={questCover(quest)} alt={`Poster for ${quest.title}`} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  {hunt ? <span className="sq-sticker sq-sticker-lime absolute -top-3 left-6 -rotate-6">Hunt · {quest.checkpoint_count} stops</span> : null}
                  <span className={`sq-sticker absolute -right-2.5 top-[70px] rotate-[8deg] ${friends ? "sq-sticker-coral" : "sq-sticker-inv"}`}>{friends ? "Friends challenge" : "Bounty"}</span>
                  <span className="sq-sticker absolute -left-2.5 bottom-[60px] -rotate-[4deg] border border-line bg-surface text-ink">{quest.visibility === "PUBLIC" ? "Public" : "Invite only"} · max {quest.max_entries}</span>
                </div>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-[22px] pb-1.5">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">{[quest.short_code ? `Quest ${quest.short_code}` : null, quest.location_name, quest.distance_km !== null ? `${quest.distance_km.toFixed(1)} km` : null].filter(Boolean).join(" · ")}</span>
                  <h1 id="quest-h" className="sq-display text-[clamp(44px,5vw,88px)] !leading-[0.84] !tracking-[-0.065em] [hyphens:manual]">{quest.title}</h1>
                  <p className="max-w-[420px] whitespace-pre-wrap text-base leading-relaxed text-ink-2">{quest.description}</p>
                  <div className="flex items-center gap-3.5 border-t border-line pt-[18px]">
                    <Link href={hostHref} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={host} url={quest.creator_avatar_url} size={48} tone="inv" ring />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[15px] font-bold">{host}{quest.organization_id ? <BadgeCheck size={15} aria-label="Organization" /> : null}</span>
                        <span className="truncate text-[13px] text-ink-2">@{quest.organization_slug ?? quest.creator_username}</span>
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <aside aria-label="Reward and join" className="relative min-w-0 max-w-[420px] flex-[1_1_340px] rounded-[28px] bg-lime text-on-lime shadow-[0_20px_44px_rgba(17,17,17,0.14)]">
              <span className="sq-sticker sq-sticker-inv absolute -right-2.5 -top-[13px] rotate-[7deg] !text-[13px]">×{quest.winner_count} winner{quest.winner_count === 1 ? "" : "s"}</span>
              <div className="flex flex-col gap-3 px-[26px] pb-[18px] pt-[26px]">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.24em]">{friends ? "At stake" : "Reward per winner"}</span>
                {reward ? (
                  <div className="flex items-end gap-3"><span className="font-display text-[clamp(84px,9vw,132px)] font-black leading-[0.78] tracking-[-0.075em]">{reward.replace(" NIM", "")}</span><span className="font-display text-[38px] font-black leading-none tracking-[-0.04em]">NIM</span></div>
                ) : <span className="font-display text-[64px] font-black uppercase leading-[0.8] tracking-[-0.06em]">{friends ? "Glory" : "Recognition"}</span>}
                <span className="text-[13px] leading-snug">{rulesLine}{reward ? " Rewards are held by SideQuest until results. Testnet NIM has no cash value." : ""}</span>
              </div>
              <div aria-hidden="true" className="relative h-[26px]">
                <span className="absolute -left-[13px] top-0 h-[26px] w-[26px] rounded-full bg-bg" />
                <span className="absolute -right-[13px] top-0 h-[26px] w-[26px] rounded-full bg-bg" />
                <span className="absolute inset-x-6 top-3 border-t-2 border-dashed border-on-lime opacity-30" />
              </div>
              <div className="flex flex-col gap-[18px] px-[26px] pb-[26px] pt-2.5">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[0.24em]">Spots · tear one off</span><span className="font-mono text-[13px] font-bold">{left} OF {quest.max_entries} LEFT</span></div>
                  <ol role="img" aria-label={`${used} of ${quest.max_entries} spots taken, ${left} left`} className="flex gap-1.5">
                    {Array.from({ length: quest.max_entries }, (_, index) => index < used ? (
                      <li key={index} className="flex h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-inv text-on-inv"><span className="font-display text-xl font-black leading-none line-through">{index + 1}</span><span className="font-mono text-[8px] font-bold tracking-[0.08em]">TAKEN</span></li>
                    ) : (
                      <li key={index} className="grid h-[54px] flex-1 place-items-center rounded-[10px] border-2 border-dashed border-on-lime font-display text-xl font-black">{index + 1}</li>
                    ))}
                  </ol>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span className="flex flex-col gap-1"><span className="text-[11px] font-extrabold uppercase tracking-[0.24em]">Ends in</span><span className="text-xs">{deadlineLabel(quest.deadline)}</span></span>
                  <span className="font-mono text-[clamp(28px,3vw,40px)] font-bold leading-none tracking-[-0.06em]">{formatCountdown(quest.deadline)}</span>
                </div>
                {isCreator ? (
                  <Link href={quest.status === "FINALIZED" && quest.reward_enabled ? `/quests/${quest.id}/settlement` : `/quests/${quest.id}/review`} className="sq-btn sq-btn-inv h-[58px] w-full">{quest.status === "FINALIZED" && quest.reward_enabled ? "Track payouts" : "Review entries"}<ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" /></Link>
                ) : <JoinButton questId={quest.id} isCreator={false} isOpen={isOpen} initialJoined={quest.viewer_joined} />}
                <div className="flex gap-2.5">
                  {!isCreator && quest.visibility === "PUBLIC" ? <SaveQuestButton questId={quest.id} initialSaved={initiallySaved} /> : null}
                  <Link href={`/quests/${quest.id}/share`} className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-on-lime text-xs font-extrabold uppercase tracking-[0.16em]"><Share2 size={17} aria-hidden="true" />Share</Link>
                </div>
                {quest.visibility === "PUBLIC" || isCreator ? (
                  <Link href={`/quests/${quest.id}/share`} className="flex items-center gap-3.5 border-t-2 border-dashed border-on-lime pt-4">
                    <span className="flex-none -rotate-3 rounded-xl border-2 border-[#111111] bg-white p-1.5"><QrCode value={shareUrl} size={56} label={`QR code for ${displayShareUrl(shareUrl)}`} /></span>
                    <span className="flex min-w-0 flex-col gap-1"><span className="text-sm font-bold">Scan to open on your phone</span><span className="truncate font-mono text-xs font-semibold">{displayShareUrl(shareUrl)}</span></span>
                  </Link>
                ) : null}
                <p className="text-xs leading-normal">Joining is free. Your spot counts only when a valid entry is accepted.</p>
              </div>
            </aside>
          </div>

          <div aria-hidden="true" className="-mx-11 overflow-hidden py-[18px]">
            <div className="-mx-10 -rotate-2 border-y-2 border-inv bg-lime text-on-lime">
              <div className="sq-marquee flex w-max gap-[18px] whitespace-nowrap px-10 py-3 font-display text-xl font-black uppercase tracking-[-0.02em]">
                {[...marquee, ...marquee, ...marquee].map((item, index) => <span key={index} className="inline-flex items-center gap-[18px]">{item}<Sparkles size={14} /></span>)}
              </div>
            </div>
          </div>

          {hunt ? (
            <section aria-labelledby="route-h" className="flex flex-col gap-5">
              <Heading index="01" id="route-h" title="The route" meta={`${quest.checkpoint_count} stops · ${quest.proof_requirements.includes("QR_CHECKPOINT") ? "QR at each stop" : "visit each stop"}`} />
              <div className="sq-map relative h-[300px] overflow-hidden rounded-[28px]">
                {checkpoints.map((checkpoint, index) => (
                  <span key={checkpoint.id} role="img" aria-label={`Stop ${checkpoint.position}, ${checkpoint.title}`} className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[14px] border-[3px] border-surface font-display text-lg font-black shadow-[0_6px_14px_rgba(17,17,17,0.22)] ${checkpoint.completed_at ? "bg-lime text-on-lime" : "bg-inv text-on-inv"}`} style={{ left: `${14 + (70 * index) / Math.max(1, checkpoints.length - 1)}%`, top: `${[66, 38, 30, 55, 44, 62, 34, 50][index % 8]}%`, rotate: `${[-8, 6, -5, 4, -6, 7, -3, 5][index % 8]}deg` }}>{checkpoint.position}</span>
                ))}
                <Link href="/map" className="sq-btn sq-btn-inv absolute bottom-[18px] right-[18px] !min-h-[46px] !px-[18px] !text-xs"><MapIcon size={16} aria-hidden="true" />Open map</Link>
              </div>
              <ol className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
                {checkpoints.map((checkpoint) => (
                  <li key={checkpoint.id} className="flex items-center gap-3.5 rounded-[20px] border-2 border-inv px-[18px] py-4"><span aria-hidden="true" className="font-display text-[44px] font-black leading-[0.8] tracking-[-0.06em]">{String(checkpoint.position).padStart(2, "0")}</span><span className="flex min-w-0 flex-col gap-[3px]"><span className="text-[15px] font-bold">{checkpoint.title}</span><span className="text-[13px] text-ink-2">{checkpoint.instructions ?? (checkpoint.latitude !== null ? `Scan inside the ${checkpoint.radius_m} m zone` : "Scan the stop's QR code")}</span></span></li>
                ))}
              </ol>
              <CheckpointPanel questId={quest.id} initialCheckpoints={checkpoints} isCreator={isCreator} joined={quest.viewer_joined} isOpen={isOpen} />
            </section>
          ) : null}

          <section aria-labelledby="win-h" className="flex flex-col gap-5">
            <Heading index={hunt ? "02" : "01"} id="win-h" title="How to win" meta={`${quest.winner_selection_method === "FIRST_VALID" ? "First valid" : "Best submission"} · ${quest.winner_count} winner${quest.winner_count === 1 ? "" : "s"}`} />
            <ol className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-7">
              <Step n={1} title={hunt ? `Find all ${quest.checkpoint_count} stops${quest.checkpoint_count ? "" : ""}` : "Join the quest"} body={hunt ? "A scan counts only inside the stop's zone. Your location is checked at each stop and never shared with other players." : "Joining is free and uses no spot. It adds the quest to My quests."} />
              <Step n={2} title={`Post your proof: ${quest.proof_requirements.map((proof) => proofLabels[proof] ?? proof.toLowerCase()).join(", ")}`} body={quest.judging_criteria ? `Judged on: ${quest.judging_criteria}` : "Every entry is stamped with server time, so nobody can sneak in late."} />
              <Step n={3} title={`Submit before ${deadlineLabel(quest.deadline)}`} body={`${host} checks each entry. ${quest.winner_selection_method === "FIRST_VALID" ? "If one fails, the next valid entry moves up." : "Winners are picked from valid entries only."}`} />
            </ol>
            {quest.group_instructions ? <p className="rounded-[20px] bg-lime-tint p-5 text-sm leading-6"><strong>Group of {quest.required_group_size}:</strong> {quest.group_instructions}</p> : null}
          </section>

          <section aria-labelledby="who-h" className="flex flex-col gap-5">
            <Heading index={hunt ? "03" : "02"} id="who-h" title="Who joined" meta={`${quest.participants_joined} joined · ${quest.entries_received} submitted`} />
            <p className="text-sm text-ink-2">{quest.participants_joined ? `${quest.participants_joined} ${quest.participants_joined === 1 ? "person has" : "people have"} joined so far.` : "Nobody has joined yet. Be the first."}</p>
          </section>

          {isCreator && quest.visibility !== "PUBLIC" && isOpen ? <InvitationPanel questId={quest.id} /> : null}

          <Results quest={quest} winners={winners} />
          {!isCreator ? <div className="flex justify-start"><ReportContentButton subjectType="QUEST" targetId={quest.id} returnPath={`/quests/${quest.id}`} /></div> : null}
        </div>
      </div>
    </AppShell>
  );
}

function Heading({ index, id, title, meta }: { index: string; id: string; title: string; meta: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3.5"><span className="font-mono text-[13px] font-bold text-ink-3">{index}</span><h2 id={id} className="font-display text-[40px] font-black uppercase leading-[0.9] tracking-[-0.05em]">{title}</h2><span className="ml-auto font-mono text-xs font-semibold uppercase text-ink-2">{meta}</span></div>
      <span className="h-px bg-line" />
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return <li className="flex flex-col gap-3"><span aria-hidden="true" className="font-display text-[104px] font-black leading-[0.76] tracking-[-0.07em]">{n}</span><span className="text-[17px] font-bold">{title}</span><span className="text-sm leading-normal text-ink-2">{body}</span></li>;
}

function Results({ quest, winners }: { quest: Quest; winners: Awaited<ReturnType<typeof getQuestWinners>> }) {
  if (quest.status === "FINALIZED") {
    const medal = ["bg-lime text-on-lime", "bg-silver text-[#111111]", "bg-coral text-[#111111]"];
    return (
      <section aria-labelledby="results-h" className="flex flex-col gap-5 rounded-[28px] bg-inv p-7 text-on-inv">
        <h2 id="results-h" className="font-display text-[40px] font-black uppercase leading-[0.9] tracking-[-0.05em]">Results</h2>
        {winners.length ? <ol className="grid gap-3 sm:grid-cols-3">{winners.map((winner) => <li key={winner.entry_id} className="flex items-center gap-3 rounded-[20px] border border-white/15 p-4"><span className={`grid h-11 w-11 place-items-center rounded-full font-display text-lg font-black ${medal[winner.winner_position - 1] ?? medal[0]}`}>{winner.winner_position}</span><Link href={`/users/${winner.participant_username}`} className="min-w-0"><strong className="block truncate">{winner.participant_display_name}</strong><span className="font-mono text-xs opacity-70">@{winner.participant_username}</span></Link></li>)}</ol> : <p className="text-sm opacity-75">No valid entry came in, so any reward goes back to the creator.</p>}
      </section>
    );
  }
  return (
    <section aria-label="Results" className="flex flex-wrap items-center gap-5 rounded-[24px] border-2 border-dashed border-line px-7 py-[26px]">
      <span className="font-display text-[28px] font-black uppercase tracking-[-0.04em]">Results</span>
      <span className="flex-[1_1_300px] text-[15px] text-ink-2">Winners appear here after {deadlineLabel(quest.deadline)}. Everyone who joined gets a note in their inbox.</span>
      <span className="sq-sticker sq-sticker-lime rotate-[4deg]">{quest.status === "OPEN" ? "Open" : quest.status.replaceAll("_", " ")}</span>
    </section>
  );
}
