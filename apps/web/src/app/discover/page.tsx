import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, ChevronRight, Map as MapIcon, Plus, Search, Sparkles, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { QuestCard } from "@/components/quest-card";
import { SectionHeading } from "@/components/section-heading";
import { SpotsMeter } from "@/components/spots-meter";
import { formatCountdown, getMyQuests, getUnreadNotificationCount, isHunt, listQuests, questCover, rewardAmount, type MyQuestSummary, type Quest } from "@/lib/api/quests";
import { getViewerForUser } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { DiscoverFilters, type DiscoverFilter } from "./discover-filters";

type Props = { searchParams: Promise<{ q?: string; filter?: string; lat?: string; lng?: string }> };
const FILTERS: DiscoverFilter[] = ["all", "near", "ending", "hunts", "recognition"];

export default function DiscoverPage({ searchParams }: Props) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><DiscoverExperience searchParams={searchParams} /></Suspense>;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function applyFilter(quests: Quest[], filter: DiscoverFilter) {
  const open = quests.filter((quest) => quest.status === "OPEN");
  if (filter === "hunts") return open.filter(isHunt);
  if (filter === "recognition") return open.filter((quest) => !quest.reward_enabled);
  if (filter === "ending") return [...open].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  return open;
}

async function DiscoverExperience({ searchParams }: Props) {
  const requested = await searchParams;
  const search = requested.q?.trim().slice(0, 80) ?? "";
  const filter = FILTERS.includes(requested.filter as DiscoverFilter) ? requested.filter as DiscoverFilter : "all";
  const latitude = Number(requested.lat), longitude = Number(requested.lng);
  const located = filter === "near" && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [viewer, quests, unread, mine] = await Promise.all([
    session?.user ? getViewerForUser(supabase, session.user) : Promise.resolve(null),
    listQuests({ search, questType: "BOUNTY", latitude: located ? latitude : undefined, longitude: located ? longitude : undefined, radiusKm: 25 }, session?.access_token).catch(() => null),
    session ? getUnreadNotificationCount(session.access_token) : Promise.resolve(0),
    session ? getMyQuests(session.access_token).catch(() => [] as MyQuestSummary[]) : Promise.resolve([] as MyQuestSummary[]),
  ]);
  const firstName = viewer?.displayName.split(/\s+/)[0];
  const visible = quests ? applyFilter(quests, filter) : null;
  const featured = visible?.find(isHunt) ?? visible?.[0] ?? null;
  const rest = visible?.filter((quest) => quest.id !== featured?.id) ?? [];
  const nearby = (quests ?? []).filter((quest) => quest.distance_km !== null).slice(0, 3);
  const onIt = mine.find((quest) => quest.relationship === "PARTICIPANT" && quest.status === "OPEN") ?? null;
  const tickerItems = buildTicker(quests ?? []);
  const columns = [rest.filter((_, index) => index % 2 === 0), rest.filter((_, index) => index % 2 === 1)];

  return <AppShell active="discover" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username } : null} unreadNotifications={unread}>
    <div className="overflow-hidden pb-16">
      {tickerItems.length ? <Ticker items={tickerItems} /> : null}
      <div className="mx-auto flex max-w-[1180px] flex-col gap-7 px-4 pt-8 sm:px-8 lg:px-12 lg:pt-10">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3.5">
            <span className="sq-label text-ink-2">{greeting()}{firstName ? `, ${firstName}` : ""}</span>
            <h1 className="sq-display text-[clamp(52px,7vw,104px)] !leading-[0.84] !tracking-[-0.065em]">Bounties<br /><span className="sq-highlight">near you.</span></h1>
          </div>
          <div className="flex w-full max-w-[420px] items-center gap-2.5">
            <form action="/discover" className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-surface px-[18px] text-ink-3">
              <Search size={18} aria-hidden="true" />
              <label htmlFor="discover-search" className="sr-only">Search bounties</label>
              <input id="discover-search" type="search" name="q" defaultValue={search} maxLength={80} placeholder="Search bounties, people, places" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
              {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
            </form>
            <Link href="/map" aria-label="Open map" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-inv text-on-inv"><MapIcon size={20} aria-hidden="true" /></Link>
          </div>
        </header>

        {!viewer ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-lime-tint px-5 py-4">
            <div><p className="text-sm font-extrabold">Browse freely as a guest</p><p className="mt-0.5 text-xs text-ink-2">You only need an account to join, save or create.</p></div>
            <Link href="/auth?next=/create" className="sq-btn sq-btn-inv !min-h-11 !text-[11px]"><Plus size={16} aria-hidden="true" />Sign in to create</Link>
          </div>
        ) : null}

        <DiscoverFilters active={filter} search={search} />

        {visible === null ? <ServiceResting /> : !visible.length ? <EmptyFeed signedIn={Boolean(viewer)} filtered={filter !== "all" || Boolean(search)} /> : <>
          {featured ? <Featured quest={featured} /> : null}
          <div className="mt-6 flex flex-wrap items-start gap-9">
            <section aria-labelledby="open-bounties" className="flex min-w-0 flex-[999_1_560px] flex-col gap-[26px]">
              <SectionHeading index="02" id="open-bounties" title={search ? `Results for “${search}”` : "Open bounties"} meta={`${rest.length} open`} />
              {rest.length ? (
                <div className="flex flex-wrap items-start gap-6">
                  {columns.map((column, columnIndex) => (
                    <div key={columnIndex} className={`flex min-w-0 flex-[1_1_280px] flex-col gap-[30px] ${columnIndex === 1 ? "sm:mt-16" : ""}`}>
                      {column.map((quest, index) => <QuestCard key={quest.id} quest={quest} tall={(index + columnIndex) % 2 === 0} />)}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-ink-2">That&apos;s the only one right now. New bounties drop every day.</p>}
            </section>
            <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
              <section aria-labelledby="nearby" className="flex flex-col gap-4">
                <div className="sq-section-rule">
                  <span className="font-mono text-xs font-bold text-ink-3">03</span>
                  <h2 id="nearby" className="font-display text-xl font-black uppercase leading-none tracking-[-0.03em]">Nearby</h2>
                  <span className="rule" aria-hidden="true" />
                  <Link href="/map" className="py-3 font-mono text-xs font-bold">OPEN MAP</Link>
                </div>
                <Link href="/map" aria-label="Open the map of nearby bounties" className="sq-map relative block h-[300px] rotate-1 overflow-hidden rounded-[26px] border border-line">
                  <span aria-hidden="true" className="absolute left-[46%] top-[52%] h-5 w-5 rounded-full border-4 border-white bg-you shadow-[0_0_0_16px_rgba(47,107,255,0.16)]" />
                  {(quests ?? []).slice(0, 3).map((quest, index) => (
                    <span key={quest.id} aria-hidden="true" className={`absolute rounded-full px-2.5 py-1.5 font-mono text-[11px] font-bold shadow-[0_6px_14px_rgba(17,17,17,0.2)] ${index === 0 ? "bg-lime text-on-lime" : "bg-inv text-on-inv"}`} style={{ left: ["62%", "14%", "70%"][index], top: ["66%", "24%", "18%"][index], transform: `rotate(${[-4, 5, -6][index]}deg)` }}>{rewardAmount(quest)?.replace(" NIM", "") ?? "★"}</span>
                  ))}
                </Link>
                {nearby.length ? (
                  <div className="flex flex-col">
                    {nearby.map((quest, index) => (
                      <Link key={quest.id} href={`/quests/${quest.id}`} className={`flex min-h-11 items-center justify-between gap-3 text-sm font-semibold ${index < nearby.length - 1 ? "border-b border-line" : ""}`}><span className="truncate">{quest.title}</span><span className="shrink-0 font-mono text-xs text-ink-2">{quest.distance_km!.toFixed(1)} KM</span></Link>
                    ))}
                  </div>
                ) : <p className="text-xs text-ink-2">Tap <strong>Near you</strong> to sort bounties by distance.</p>}
              </section>
              {onIt ? <OnIt quest={onIt} /> : null}
              <Link href={viewer ? "/friends" : "/auth?next=/friends"} className="flex items-center gap-3.5 rounded-[22px] border border-line bg-surface px-[18px] py-4">
                <span className="grid h-11 w-11 flex-none -rotate-6 place-items-center rounded-full bg-coral text-[#111111]"><UsersRound size={20} aria-hidden="true" /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]"><span className="text-sm font-bold">Your friends&apos; challenges live in Friends</span><span className="text-xs text-ink-2">Private dares, races and room votes</span></span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </>}
      </div>
    </div>
  </AppShell>;
}

function buildTicker(quests: Quest[]) {
  const open = quests.filter((quest) => quest.status === "OPEN");
  if (!open.length) return [];
  const items: string[] = [];
  const hunts = open.filter(isHunt).length;
  if (hunts) items.push(`Live · ${hunts} hunt${hunts === 1 ? "" : "s"} near you`);
  for (const quest of open.slice(0, 4)) {
    const reward = rewardAmount(quest);
    const host = quest.organization_display_name ?? quest.creator_display_name;
    items.push(reward ? `${host} just dropped ${reward}` : `${host} wants: ${quest.title}`);
    items.push(`${Math.max(0, quest.max_entries - quest.entries_received)} of ${quest.max_entries} spots left on ${quest.title}`);
  }
  items.push(`${open.length} open bount${open.length === 1 ? "y" : "ies"}`);
  return items;
}

function Ticker({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div aria-label="Live near you" className="mx-[-40px] mt-[26px] h-11 -rotate-[1.5deg] overflow-hidden bg-lime text-on-lime">
      <div className="sq-marquee flex h-full w-max items-center gap-[18px] whitespace-nowrap px-10 font-mono text-[13px] font-bold uppercase tracking-[0.06em]">
        {loop.map((item, index) => <span key={index} className="flex items-center gap-[18px]" aria-hidden={index >= items.length}>{item}<Sparkles size={12} aria-hidden="true" /></span>)}
      </div>
    </div>
  );
}

function Featured({ quest }: { quest: Quest }) {
  const hunt = isHunt(quest);
  const used = Math.min(quest.entries_received, quest.max_entries);
  const reward = rewardAmount(quest);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date()).replace(",", " ·").toUpperCase();
  return (
    <section aria-labelledby="hotd" className="mt-2 flex flex-col gap-7">
      <SectionHeading index="01" id="hotd" title={hunt ? "Hunt of the day" : "Bounty of the day"} meta={today} />
      <div className="flex flex-wrap items-center gap-14">
        <Link href={`/quests/${quest.id}`} aria-label={`Open ${quest.title}`} className="relative ml-2.5 mt-3.5 aspect-[4/5] flex-[0_1_400px] -rotate-[2.5deg] text-white">
          <span className="absolute inset-0 overflow-hidden rounded-[28px] border-[6px] border-surface shadow-[var(--shadow-pop)]">
            <img src={questCover(quest)} alt={`Poster art for ${quest.title}`} className="absolute inset-0 h-full w-full object-cover" />
          </span>
          <span className="sq-sticker sq-sticker-lime absolute -top-3.5 left-[26px] -rotate-[8deg] shadow-[0_6px_14px_rgba(17,17,17,0.18)]">{hunt ? `Hunt · ${quest.checkpoint_count} stops` : "Bounty"}</span>
          {reward ? <span className="sq-sticker sq-sticker-inv absolute -right-4 bottom-[60px] rotate-[7deg] px-4 py-2.5 !text-[15px] shadow-[0_6px_14px_rgba(17,17,17,0.22)]">{reward} × {quest.winner_count}</span> : null}
        </Link>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
          <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.24em] text-ink-2">By {quest.organization_display_name ?? quest.creator_display_name}{quest.organization_id ? <BadgeCheck size={14} aria-label="Organization" /> : null}{quest.distance_km !== null ? ` · ${quest.distance_km.toFixed(1)} km` : quest.location_name ? ` · ${quest.location_name}` : ""}</span>
          <div className="relative">
            <div className="sq-display text-[clamp(48px,7vw,120px)] !leading-[0.82] !tracking-[-0.07em]">{quest.title}</div>
            <span className="sq-sticker sq-sticker-inv absolute right-[8%] top-1 rotate-[8deg]">{quest.winner_selection_method === "FIRST_VALID" ? `First ${quest.winner_count} win` : "Best entry wins"}</span>
            {quest.participants_joined ? <span className="sq-sticker sq-sticker-coral absolute -bottom-2.5 left-[52%] rotate-[4deg]">+{quest.participants_joined} joined</span> : null}
          </div>
          <p className="line-clamp-3 max-w-[520px] text-[17px] leading-relaxed text-ink-2">{quest.description}</p>
          <div className="flex flex-wrap items-end gap-9 border-t-2 border-dashed border-line pt-[18px]">
            <span className="flex flex-col gap-2">
              <span className="flex items-end gap-3.5"><span className="font-display text-[52px] font-black leading-[0.82] tracking-[-0.05em]">{quest.max_entries - used}/{quest.max_entries}</span><SpotsMeter total={quest.max_entries} used={used} size="lg" numbered /></span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-ink-3">Spots left</span>
            </span>
            <span className="flex flex-col gap-2">
              <span className="font-display text-[52px] font-black leading-[0.82] tracking-[-0.05em]">{formatCountdown(quest.deadline)}</span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-ink-3">Ends in</span>
            </span>
            <Link href={`/quests/${quest.id}`} className="ml-auto grid h-[116px] w-[116px] place-items-center content-center gap-1.5 rounded-full bg-lime text-[13px] font-extrabold uppercase tracking-[0.22em] text-on-lime shadow-[0_18px_40px_rgba(17,17,17,0.14)] transition hover:scale-105">{hunt ? "View hunt" : "View"}<ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function OnIt({ quest }: { quest: MyQuestSummary }) {
  const progress = Math.min(100, Math.round((quest.entries_received / Math.max(1, quest.max_entries)) * 100));
  const due = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Africa/Lagos" }).format(new Date(quest.deadline)).toUpperCase();
  return (
    <section aria-labelledby="on-it" className="relative mt-3 flex flex-col gap-4 rounded-[26px] bg-inv px-6 pb-[22px] pt-[26px] text-on-inv">
      <span className="sq-sticker sq-sticker-lime absolute -top-3 right-[18px] rotate-6">Joined</span>
      <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold opacity-70">04</span><h2 id="on-it" className="font-display text-xl font-black uppercase leading-none tracking-[-0.03em]">You&apos;re on it</h2></div>
      <Link href={`/quests/${quest.id}`} className="flex items-center gap-3.5">
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="truncate text-[15px] font-bold">{quest.title}</span>
          <span className="relative block h-2 overflow-hidden rounded"><span className="absolute inset-0 bg-on-inv opacity-20" /><span className="absolute inset-y-0 left-0 rounded bg-lime" style={{ width: `${Math.max(6, progress)}%` }} /></span>
          <span className="font-mono text-[11px] font-semibold opacity-80">{quest.reward_enabled && quest.reward_amount_minor ? `${quest.reward_amount_minor / 100_000} NIM · ` : ""}DUE {due}</span>
        </span>
      </Link>
      <div className="flex items-end justify-between gap-3 border-t-2 border-dashed border-[rgba(127,127,127,0.4)] pt-4">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] opacity-75">{quest.viewer_entry_id ? "Entry in · waiting on results" : "Submit proof before the deadline"}</span>
        <Link href="/quests" className="flex h-11 items-center whitespace-nowrap rounded-full border-[1.5px] border-on-inv px-4 text-[11px] font-extrabold uppercase tracking-[0.16em]">All my quests</Link>
      </div>
    </section>
  );
}

function ServiceResting() {
  return <div className="sq-card p-7"><Sparkles aria-hidden="true" /><h2 className="mt-4 font-display text-2xl font-black uppercase tracking-[-0.03em]">The quest feed is reconnecting.</h2><p className="mt-1 text-sm text-ink-2">Your account is fine. Refresh in a moment and the bounties will be back.</p></div>;
}

function EmptyFeed({ signedIn, filtered }: { signedIn: boolean; filtered: boolean }) {
  return (
    <div className="sq-card flex flex-col items-center gap-4 p-10 text-center">
      <span className="sq-sticker sq-sticker-lime -rotate-3">{filtered ? "No match" : "Fresh start"}</span>
      <h2 className="sq-display text-[44px]">{filtered ? "Nothing here yet." : "Be the first."}</h2>
      <p className="max-w-md text-sm leading-6 text-ink-2">{filtered ? "Try another filter, or clear your search." : "No bounties are open right now. Post one for your community and it shows up here."}</p>
      <div className="flex flex-wrap justify-center gap-2.5">
        {filtered ? <Link href="/discover" className="sq-btn sq-btn-ghost">Clear filters</Link> : null}
        <Link href={signedIn ? "/create" : "/auth?next=/create"} className="sq-btn sq-btn-lime"><Plus size={16} aria-hidden="true" />Create a bounty</Link>
      </div>
    </div>
  );
}
