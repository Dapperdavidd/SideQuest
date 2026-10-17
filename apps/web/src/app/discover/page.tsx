import Link from "next/link";
import { Suspense } from "react";
import {
  Bell,
  Bookmark,
  Compass,
  Plus,
  Search,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { QuestCard } from "@/components/quest-card";
import {
  formatDeadline,
  formatReward,
  getUnreadNotificationCount,
  listQuests,
  questImageClass,
  type Quest,
} from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type DiscoverPageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

const filters = [
  ["All", ""],
  ["Friends", "FRIENDS"],
  ["Bounties", "BOUNTY"],
  ["Explore", "EXPLORE"],
] as const;

export default function DiscoverPage({ searchParams }: DiscoverPageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen animate-pulse bg-[#101310]" />}>
      <DiscoverExperience searchParams={searchParams} />
    </Suspense>
  );
}

async function DiscoverExperience({ searchParams }: DiscoverPageProps) {
  const requested = await searchParams;
  const search = requested.q?.trim().slice(0, 80) ?? "";
  const questType = ["FRIENDS", "BOUNTY", "EXPLORE"].includes(requested.type ?? "")
    ? requested.type as Quest["quest_type"]
    : undefined;
  const viewerPromise = getViewer();
  const questsPromise = listQuests({ search, questType }).catch(() => null);
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const unreadPromise = session ? getUnreadNotificationCount(session.access_token) : Promise.resolve(0);
  const [viewer, quests, unreadNotifications] = await Promise.all([viewerPromise, questsPromise, unreadPromise]);
  const firstName = viewer?.displayName.split(/\s+/)[0] || "Explorer";
  const initial = firstName.charAt(0).toUpperCase();
  const featured = quests?.[0] ?? null;

  return (
    <main className="min-h-screen bg-[#101310] p-3 text-white sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1500px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#151815] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 px-5 py-7 lg:flex lg:flex-col">
          <Logo inverse />
          <nav className="mt-12 space-y-2" aria-label="App navigation">
            <Link className="flex items-center gap-3 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-dark" href="/discover"><Compass size={19} />Discover</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href={viewer ? "/quests" : "/auth?next=/quests"}><Trophy size={19} />Quests</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href={viewer ? "/wallet" : "/auth?next=/wallet"}><WalletCards size={19} />Wallet</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href={viewer ? "/notifications" : "/auth?next=/notifications"}><Bell size={19} />Notifications{unreadNotifications ? <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-dark">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href={viewer ? "/create" : "/auth?next=/create"}><Plus size={19} />Create</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href={viewer ? "/profile" : "/auth"}><UserRound size={19} />{viewer ? "Profile" : "Sign in"}</Link>
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2 text-xs font-bold text-accent"><Sparkles size={14} /> MINI APP READY</div><p className="mt-2 text-xs leading-5 text-white/50">Connect Nimiq Pay only when you are ready to fund or receive a reward.</p></div>
        </aside>
        <section className="min-w-0">
          <header className="flex items-center gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
            <div className="lg:hidden"><Logo inverse /></div>
            <form action="/discover" className="hidden max-w-md flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 sm:flex"><Search size={17} className="text-white/40" /><label htmlFor="discover-search" className="sr-only">Search quests</label><input id="discover-search" name="q" defaultValue={search} maxLength={80} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35" placeholder="Search quests or creators…" />{questType ? <input type="hidden" name="type" value={questType} /> : null}<button type="submit" className="text-xs font-bold text-accent">Search</button></form>
            <Link href={viewer ? "/notifications" : "/auth?next=/notifications"} aria-label="Notifications" className="relative ml-auto grid h-10 w-10 place-items-center rounded-full border border-white/10"><Bell size={18} />{unreadNotifications ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-bold text-dark">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span> : null}</Link>
            <Link href={viewer ? "/profile" : "/auth"} aria-label={viewer ? "Open profile" : "Sign in"} className="grid h-10 w-10 place-items-center rounded-full bg-accent font-display font-bold text-dark">{initial}</Link>
          </header>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0 px-5 py-7 sm:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-white/45">{viewer ? `Welcome back, ${firstName}` : "Browse freely as a guest"}</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">What will you do today?</h1></div><Link href={viewer ? "/create" : "/auth?next=/create"} className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark">{viewer ? "Create a quest" : "Sign in to create"}</Link></div>
              <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{filters.map(([label, value]) => { const selected = (questType ?? "") === value; const params = new URLSearchParams(); if (search) params.set("q", search); if (value) params.set("type", value); return <Link key={label} href={`/discover${params.size ? `?${params.toString()}` : ""}`} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${selected ? "bg-accent text-dark" : "border border-white/10 text-white/60"}`}>{label}</Link>; })}</div>

              {featured ? <FeaturedQuest quest={featured} /> : null}

              <div className="mt-8 flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">{search ? `Results for “${search}”` : questType ? `${filters.find(([, value]) => value === questType)?.[0]} quests` : "Open quests"}</h2>{(search || questType) ? <Link href="/discover" className="mt-1 inline-block text-xs font-semibold text-accent">Clear filters</Link> : null}</div>{quests?.length ? <span className="text-sm text-white/50">{quests.length} found</span> : null}</div>
              {quests === null ? (
                <div className="mt-4 rounded-[1.25rem] border border-[#ffcf5a]/25 bg-[#ffcf5a]/10 p-6"><h3 className="font-bold text-[#ffe3a0]">The quest service is taking a breather.</h3><p className="mt-2 text-sm leading-6 text-white/55">Your account is fine. Refresh in a moment to reconnect to the live feed.</p></div>
              ) : quests.length ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{quests.map((quest) => <QuestCard key={quest.id} href={`/quests/${quest.id}`} imageClass={questImageClass(quest.quest_type)} imageUrl={quest.cover_media_url} title={quest.title} creator={quest.creator_display_name} reward={quest.reward_enabled ? formatReward(quest) : undefined} entries={`${quest.entries_received}/${quest.max_entries} entries`} deadline={formatDeadline(quest.deadline)} />)}</div>
              ) : (
                <div className="mt-4 rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-dark"><Plus size={22} /></span><h3 className="mt-4 font-display text-xl font-bold">The first quest is yours to create.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Publish a free challenge now. Reward quests stay private until their funding is verified.</p><Link href={viewer ? "/create" : "/auth?next=/create"} className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark">{viewer ? "Create the first quest" : "Sign in to create"}</Link></div>
              )}
            </div>
            <aside className="hidden border-l border-white/10 p-6 xl:block">
              {featured ? <QuestSpotlight quest={featured} /> : <DiscoveryGuide />}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeaturedQuest({ quest }: { quest: Quest }) {
  return (
    <Link href={`/quests/${quest.id}`} className={`${questImageClass(quest.quest_type)} mt-5 block min-h-[310px] rounded-[1.35rem] bg-cover bg-center p-6 sm:p-8`} style={quest.cover_media_url ? { backgroundImage: `linear-gradient(rgba(23,25,23,.12),rgba(23,25,23,.78)),url(${JSON.stringify(quest.cover_media_url)})` } : undefined}>
      <div className="flex min-h-[250px] max-w-xl flex-col justify-end">
        <span className="w-fit rounded-full bg-[#9167ff] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider">Featured {quest.quest_type.toLowerCase()}</span>
        <h2 className="mt-3 font-display text-3xl font-bold">{quest.title}</h2>
        <p className="mt-2 line-clamp-2 text-sm text-white/70">{quest.description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-semibold"><span>{formatReward(quest)}</span><span>{quest.entries_received}/{quest.max_entries} entries</span><span>{quest.winner_count} winner{quest.winner_count === 1 ? "" : "s"}</span><span>{formatDeadline(quest.deadline)}</span></div>
      </div>
    </Link>
  );
}

function QuestSpotlight({ quest }: { quest: Quest }) {
  return (
    <>
      <div className={`${questImageClass(quest.quest_type)} h-52 rounded-[1.25rem] bg-cover bg-center`} style={quest.cover_media_url ? { backgroundImage: `url(${JSON.stringify(quest.cover_media_url)})` } : undefined} />
      <div className="mt-5 flex items-start justify-between gap-4"><div><span className="rounded-full bg-[#9167ff] px-2.5 py-1 text-[0.62rem] font-bold uppercase">{quest.quest_type}</span><h2 className="mt-3 font-display text-2xl font-bold leading-tight">{quest.title}</h2></div><button aria-label="Save quest" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10"><Bookmark size={18} /></button></div>
      <p className="mt-4 line-clamp-4 text-sm leading-6 text-white/55">{quest.description}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/10 p-3"><dt className="text-lg font-bold">{formatReward(quest)}</dt><dd className="text-[0.65rem] text-white/45">per winner</dd></div><div className="rounded-xl border border-white/10 p-3"><dt className="text-lg font-bold">{quest.winner_count}</dt><dd className="text-[0.65rem] text-white/45">winner{quest.winner_count === 1 ? "" : "s"}</dd></div><div className="rounded-xl border border-white/10 p-3"><dt className="text-lg font-bold">{Math.max(0, quest.max_entries - quest.entries_received)}</dt><dd className="text-[0.65rem] text-white/45">slots left</dd></div></dl>
      <div className="mt-5 flex items-center gap-2 text-sm text-white/60"><UsersRound size={16} /> {quest.participants_joined} joined</div>
      <Link href={`/quests/${quest.id}`} className="mt-6 block w-full rounded-xl bg-accent py-3.5 text-center font-bold text-dark">View quest</Link>
      <p className="mt-3 text-center text-xs text-white/35">Submitting, not joining, uses one of the entry slots.</p>
    </>
  );
}

function DiscoveryGuide() {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-6"><span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-dark"><Compass size={22} /></span><h2 className="mt-5 font-display text-2xl font-bold">Real people. Real quests.</h2><p className="mt-3 text-sm leading-6 text-white/55">The feed now shows only published quests from the live database. Joining records your interest; a submission uses an entry slot.</p></div>
  );
}
