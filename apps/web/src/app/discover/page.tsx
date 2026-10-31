import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Compass, MapPin, Plus, Search, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { QuestCard } from "@/components/quest-card";
import { formatDeadline, formatReward, getUnreadNotificationCount, listQuests, questImageClass, type Quest } from "@/lib/api/quests";
import { getViewerForUser } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { DiscoverFilters } from "./discover-filters";
import { NearbyButton } from "./nearby-button";

type Props = { searchParams: Promise<{ q?: string; type?: string; lat?: string; lng?: string; nearby?: string }> };
const names = { FRIENDS: "Friends", BOUNTY: "Reward", EXPLORE: "Explore" } as const;

export default function DiscoverPage({ searchParams }: Props) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-[#f4f1e8]" />}><DiscoverExperience searchParams={searchParams} /></Suspense>;
}

async function DiscoverExperience({ searchParams }: Props) {
  const requested = await searchParams;
  const search = requested.q?.trim().slice(0, 80) ?? "";
  const questType = ["FRIENDS", "BOUNTY", "EXPLORE"].includes(requested.type ?? "") ? requested.type as Quest["quest_type"] : undefined;
  const latitude = Number(requested.lat), longitude = Number(requested.lng);
  const nearby = requested.nearby === "1" && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [viewer, quests, unread] = await Promise.all([
    session?.user ? getViewerForUser(supabase, session.user) : Promise.resolve(null),
    listQuests({ search, questType, latitude: nearby ? latitude : undefined, longitude: nearby ? longitude : undefined, radiusKm: 25 }, session?.access_token).catch(() => null),
    session ? getUnreadNotificationCount(session.access_token) : Promise.resolve(0),
  ]);
  const firstName = viewer?.displayName.split(/\s+/)[0] || "Explorer";
  const featured = quests?.[0] ?? null;
  const remaining = quests?.slice(featured ? 1 : 0) ?? [];

  return <AppShell active="discover" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl } : null} unreadNotifications={unread}>
    <div className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9"><div className="mx-auto max-w-[1220px]">
      <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="app-eyebrow">Your world, but more interesting</p><h1 className="mt-2 max-w-2xl font-display text-[2.35rem] font-extrabold leading-[.98] tracking-[-0.055em] text-dark sm:text-5xl">What will you do today{viewer ? `, ${firstName}` : ""}?</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">Find something small, surprising, or worth doing together. No gaming experience needed.</p></div>
        <Link href={viewer ? "/create" : "/auth?next=/create"} className="inline-flex w-fit items-center gap-2 rounded-full bg-dark px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"><Plus size={17} />{viewer ? "Start a quest" : "Sign in to create"}</Link>
      </header>
      {!viewer ? <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-[#b6d92d]/35 bg-[#eaff9b]/55 px-5 py-4"><div><p className="text-sm font-extrabold text-dark">Browse freely as a guest</p><p className="mt-0.5 text-xs text-[#565b48]">You only need an account when you want to join, save, or create.</p></div><Link href="/auth?next=/discover" className="text-sm font-bold underline decoration-black/25 underline-offset-4">Sign in when you’re ready</Link></div> : null}
      <form action="/discover" className="mt-7 flex items-center gap-3 rounded-[1.2rem] border border-black/8 bg-white px-4 py-3.5 shadow-[0_10px_30px_rgba(35,33,22,.05)]"><Search size={19} className="shrink-0 text-muted" /><label htmlFor="discover-search" className="sr-only">Search quests</label><input id="discover-search" name="q" defaultValue={search} maxLength={80} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[#94968d]" placeholder="Try “coffee”, “with friends”, or a place…" />{questType ? <input type="hidden" name="type" value={questType} /> : null}<button type="submit" className="rounded-full bg-dark px-4 py-2 text-xs font-bold text-white">Search</button></form>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2"><DiscoverFilters activeType={nearby ? undefined : questType} search={search} /><NearbyButton active={nearby} search={search} /></div>
      {featured ? <FeaturedQuest quest={featured} /> : null}
      <section className="mt-10"><div className="flex items-end justify-between gap-4"><div><p className="app-eyebrow">Made by the community</p><h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em] text-dark">{nearby ? "Near you" : search ? `Results for “${search}”` : questType ? `${names[questType]} quests` : "More ways to make today count"}</h2></div>{(search || questType || nearby) ? <Link href="/discover" className="shrink-0 text-xs font-bold underline underline-offset-4">Clear filters</Link> : quests?.length ? <span className="hidden text-xs font-bold text-muted sm:block">{quests.length} open now</span> : null}</div>
        {quests === null ? <ServiceResting /> : quests.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{remaining.length ? remaining.map((quest) => <QuestTile key={quest.id} quest={quest} />) : <QuestTile quest={featured!} />}</div> : <EmptyFeed viewer={Boolean(viewer)} />}
      </section>
      <section id="how-it-works" className="mt-12 scroll-mt-8 overflow-hidden rounded-[1.7rem] bg-dark px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="app-eyebrow !text-accent">Your first quest</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em]">Easy as pick, join, share.</h2><p className="mt-3 text-sm leading-6 text-white/55">SideQuest tells you exactly what to do. You choose how adventurous today gets.</p></div><ol className="grid gap-3 sm:grid-cols-3"><HowStep number="1" title="Pick one" body="Choose a quest that fits your mood and time." /><HowStep number="2" title="Join in" body="See the rules, tap join, and go do the thing." /><HowStep number="3" title="Share proof" body="Post a photo, video, or check-in when you’re done." /></ol></div></section>
    </div></div>
  </AppShell>;
}

function QuestTile({ quest }: { quest: Quest }) { return <QuestCard href={`/quests/${quest.id}`} imageClass={questImageClass(quest.quest_type)} imageUrl={quest.cover_media_url} title={quest.title} creator={quest.creator_display_name} creatorAvatarUrl={quest.creator_avatar_url} reward={quest.reward_enabled ? formatReward(quest) : undefined} entries={`${quest.entries_received}/${quest.max_entries} spots`} deadline={formatDeadline(quest.deadline)} location={quest.location_name} distanceKm={quest.distance_km} questType={quest.quest_type} participants={quest.participants_joined} />; }

function FeaturedQuest({ quest }: { quest: Quest }) {
  return <section className="mt-7 overflow-hidden rounded-[1.7rem] bg-dark text-white"><div className="grid lg:grid-cols-[1.2fr_.8fr]"><div className={`${questImageClass(quest.quest_type)} min-h-[310px] bg-cover bg-center p-5 sm:min-h-[390px] sm:p-7`} style={quest.cover_media_url ? { backgroundImage: `linear-gradient(rgba(23,25,23,.03),rgba(23,25,23,.64)),url(${JSON.stringify(quest.cover_media_url)})` } : undefined}><div className="flex h-full min-h-[270px] flex-col justify-between sm:min-h-[336px]"><span className="w-fit rounded-full bg-accent px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[.12em] text-dark">Quest of the day</span><div><p className="flex items-center gap-2 text-xs font-bold text-white/75"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-white text-dark">{quest.creator_avatar_url ? <img src={quest.creator_avatar_url} alt="" className="h-full w-full object-cover" /> : quest.creator_display_name.charAt(0)}</span>Hosted by {quest.creator_display_name}</p><h2 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-5xl">{quest.title}</h2></div></div></div><div className="flex flex-col p-6 sm:p-8"><span className="app-eyebrow !text-accent">Why you’ll like it</span><p className="mt-3 line-clamp-4 text-sm leading-6 text-white/62">{quest.description}</p>{quest.location_name ? <p className="mt-5 flex items-center gap-2 text-sm font-bold"><MapPin size={16} className="text-accent" />{quest.location_name}</p> : null}<div className="mt-5 grid grid-cols-3 gap-2"><Stat value={quest.participants_joined ? String(quest.participants_joined) : "New"} label="joined" /><Stat value={formatDeadline(quest.deadline)} label="time left" /><Stat value={quest.reward_enabled ? formatReward(quest) : "Just fun"} label="reward" /></div><Link href={`/quests/${quest.id}`} className="mt-6 flex items-center justify-between rounded-full bg-accent px-5 py-3.5 font-bold text-dark lg:mt-auto">See this quest <ArrowRight size={18} /></Link></div></div></section>;
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border border-white/10 p-3"><p className="truncate text-sm font-extrabold">{value}</p><p className="mt-0.5 text-[0.64rem] text-white/42">{label}</p></div>; }
function HowStep({ number, title, body }: { number: string; title: string; body: string }) { return <li className="rounded-[1.2rem] border border-white/10 bg-white/[0.055] p-4"><span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-extrabold text-dark">{number}</span><h3 className="mt-5 font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-white/48">{body}</p></li>; }
function ServiceResting() { return <div className="app-card mt-5 rounded-[1.4rem] p-7"><Zap className="text-[#9c7300]" /><h3 className="mt-4 font-bold">The quest feed is reconnecting.</h3><p className="mt-1 text-sm text-muted">Your account is fine. Refresh in a moment and your quests will be back.</p></div>; }
function EmptyFeed({ viewer }: { viewer: boolean }) { return <div className="app-card mt-5 rounded-[1.4rem] p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent"><Compass size={21} /></span><h3 className="mt-4 font-display text-xl font-extrabold">Nothing here yet. Want to go first?</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Try another filter, or start an easy quest for your friends and community.</p><Link href={viewer ? "/create" : "/auth?next=/create"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-dark px-5 py-3 text-sm font-bold text-white"><Plus size={16} />Create a quest</Link></div>; }
