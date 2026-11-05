import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { QrCode } from "@/components/qr-code";
import { SpotsMeter } from "@/components/spots-meter";
import { getQuest, isHunt, rewardAmount } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { displayShareUrl, questShareUrl } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";
import { ShareLinkField, ShareTargets } from "./share-actions";

export default function ShareQuestPage(props: PageProps<"/quests/[id]/share">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><ShareQuestPageContent {...props} /></Suspense>;
}

async function ShareQuestPageContent({ params }: PageProps<"/quests/[id]/share">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [quest, viewer] = await Promise.all([getQuest(id, session?.access_token), getViewer()]);
  if (!quest) notFound();
  const url = questShareUrl(quest.short_code, quest.id);
  const display = displayShareUrl(url);
  const isCreator = viewer?.id === quest.creator_id;
  const friends = quest.quest_type === "FRIENDS";
  const host = quest.organization_display_name ?? quest.creator_display_name;
  const reward = rewardAmount(quest);
  const used = Math.min(quest.entries_received, quest.max_entries);
  const ends = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(quest.deadline));

  return (
    <AppShell active={isCreator ? "quests" : friends ? "friends" : "discover"} viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username } : null}>
      <div className="px-4 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-9">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex min-w-0 flex-col gap-2.5">
              {isCreator && quest.status !== "DRAFT" ? <span className="inline-flex items-center gap-2 text-[15px] font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-lime text-on-lime"><Check size={14} strokeWidth={3} aria-hidden="true" /></span>{quest.status === "OPEN" ? "Published" : quest.status === "AWAITING_FUNDING" ? "Opens once funding is verified" : quest.status.replaceAll("_", " ").toLowerCase()}</span> : null}
              <h1 className="sq-display text-[clamp(40px,5vw,60px)] !leading-[0.9] !tracking-[-0.045em]">{isCreator ? "Your quest is live" : "Share this quest"}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`sq-pill ${friends ? "bg-coral text-[#111111]" : "bg-lime text-[#111111]"}`}>{friends ? "Friends" : "Bounty"}</span>
                {isHunt(quest) ? <span className="sq-pill bg-lime-tint text-ink">Hunt</span> : null}
                <span className="text-[15px] text-ink-2">{[quest.title, host, isHunt(quest) ? `${quest.checkpoint_count} stops` : null].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {isCreator ? <Link href="/quests" className="sq-btn sq-btn-ghost">My quests</Link> : null}
              <Link href={`/quests/${quest.id}`} className="sq-btn sq-btn-lime">Open quest<ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" /></Link>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <section aria-label="Share" className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
              <div className="sq-card flex flex-wrap items-center gap-7 p-6">
                <div className="w-[248px] max-w-full flex-none rounded-[20px] border border-line bg-white p-4"><QrCode value={url} size={214} label={`QR code that opens ${display}`} className="mx-auto" /></div>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-display text-[22px] font-black uppercase tracking-[-0.02em]">Scan to join</h2>
                    <p className="text-[15px] leading-snug text-ink-2">Point a phone camera at the code. Scans open the SideQuest app on phones that have it, or the quest page on the web.</p>
                  </div>
                  <ShareLinkField url={url} display={display} />
                  <span className="text-xs text-ink-3">{friends ? "Only invited friends and group members can open this challenge." : "Anyone with the link can see the quest. Spots are used only when people submit."}</span>
                </div>
              </div>
              <div className="sq-card flex flex-col gap-4 p-5">
                <h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">Share to</h2>
                <ShareTargets url={url} title={quest.title} />
              </div>
              <div className="sq-card flex flex-wrap items-center gap-6 p-5">
                <Stat label="Joined" value={String(quest.participants_joined)} />
                <Stat label="Entries" value={String(quest.entries_received)} suffix={`of ${quest.max_entries}`} />
                <div className="flex flex-[2_1_220px] flex-col gap-2"><SpotsMeter total={quest.max_entries} used={used} /><span className="text-xs text-ink-2">{quest.max_entries - used} of {quest.max_entries} spots left · ends {ends}</span></div>
              </div>
            </section>

            <aside aria-label="QR poster" className="sq-card flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-5">
              <div className="flex flex-col gap-1"><h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">QR poster</h2><span className="text-[13px] leading-snug text-ink-2">A5, ready to print for a shop counter or window.</span></div>
              <div className="flex justify-center rounded-2xl bg-sunken p-5">
                <div role="img" aria-label={`A5 poster preview: ${quest.title}, scan to join`} className="flex aspect-[148/210] w-full max-w-[236px] flex-col gap-2.5 rounded bg-white p-4 text-[#111111] shadow-[0_8px_24px_rgba(17,17,17,0.12)]">
                  <div className="flex items-center justify-between"><span className="font-display text-[15px] font-black tracking-[-0.05em]">sidequest.</span><span className="rounded-full bg-[#e0fe5e] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider">{friends ? "Friends" : isHunt(quest) ? "Bounty · Hunt" : "Bounty"}</span></div>
                  <span className="font-display text-[21px] font-black uppercase leading-[0.95] tracking-[-0.04em]">{quest.title}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">Scan to join</span>
                  <div className="w-[62%] self-center rounded-lg border border-[#e7e7ea] p-1.5"><QrCode value={url} size={110} label="" className="!h-auto !w-full" /></div>
                  <div className="mt-auto flex flex-col gap-1 border-t border-[#e7e7ea] pt-2">
                    <span className="text-[10px] font-bold">{host}</span>
                    <div className="flex items-center justify-between gap-1.5"><span className="rounded-full bg-[#e0fe5e] px-1.5 py-0.5 font-mono text-[9px] font-semibold">{reward ? `${reward} × ${quest.winner_count}` : "Recognition"}</span><span className="text-[9px] text-[#55565c]">Ends {ends.split(",")[0]}</span></div>
                    <span className="font-mono text-[8px] text-[#6b6c73]">{display}</span>
                  </div>
                </div>
              </div>
              <Link href={`/quests/${quest.id}/poster`} target="_blank" className="sq-btn sq-btn-inv"><Printer size={17} aria-hidden="true" />Download QR poster</Link>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return <div className="flex flex-[1_1_140px] flex-col gap-0.5"><span className="text-[13px] text-ink-2">{label}</span><span className="font-display text-[30px] font-black tracking-[-0.03em]">{value}{suffix ? <span className="ml-1 font-sans text-base font-semibold tracking-normal text-ink-2">{suffix}</span> : null}</span></div>;
}
