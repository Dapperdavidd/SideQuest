import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getUnreadNotificationCount, isHunt, listQuests, rewardAmount, type Quest } from "@/lib/api/quests";
import { getViewerForUser } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Map" };

export default function MapPage(props: PageProps<"/map">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><MapContent {...props} /></Suspense>;
}

/** Places pins relative to each other inside the visible area of the map art. */
function project(quests: Quest[]) {
  const located = quests.filter((quest) => quest.latitude !== null && quest.longitude !== null);
  if (!located.length) return [];
  const lats = located.map((quest) => quest.latitude!), lngs = located.map((quest) => quest.longitude!);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = (min: number, max: number, value: number) => (max - min < 1e-6 ? 0.5 : (value - min) / (max - min));
  return located.map((quest) => ({ quest, x: 10 + 80 * span(minLng, maxLng, quest.longitude!), y: 88 - 76 * span(minLat, maxLat, quest.latitude!) }));
}

async function MapContent({ searchParams }: PageProps<"/map">) {
  const { selected, q } = await searchParams;
  const search = typeof q === "string" ? q.slice(0, 80) : "";
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [viewer, quests, unread] = await Promise.all([
    session?.user ? getViewerForUser(supabase, session.user) : Promise.resolve(null),
    listQuests({ questType: "BOUNTY", search }, session?.access_token).catch(() => [] as Quest[]),
    session ? getUnreadNotificationCount(session.access_token) : Promise.resolve(0),
  ]);
  const open = quests.filter((quest) => quest.status === "OPEN");
  const pins = project(open);
  const active = open.find((quest) => quest.id === selected) ?? pins[0]?.quest ?? null;

  return (
    <AppShell active="map" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username } : null} unreadNotifications={unread}>
      <div className="flex min-h-[calc(100vh-68px)] flex-col gap-4 px-4 pb-24 pt-6 sm:px-8 lg:min-h-screen lg:px-9 lg:pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2"><span className="sq-label text-ink-2">Bounties and hunts</span><h1 className="sq-display text-[clamp(44px,5vw,72px)]">On the <span className="sq-highlight">map.</span></h1></div>
          <form action="/map" className="flex h-[52px] w-full max-w-[380px] items-center gap-2.5 rounded-full border border-line bg-surface px-[18px] text-ink-3">
            <Search size={18} aria-hidden="true" /><label htmlFor="map-search" className="sr-only">Search places</label>
            <input id="map-search" type="search" name="q" defaultValue={search} placeholder="Search bounties or places" className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
          </form>
        </div>
        <div className="flex flex-1 flex-wrap gap-5">
          <div className="sq-map relative min-h-[420px] min-w-0 flex-[999_1_560px] overflow-hidden rounded-[28px] border border-line">
            {pins.map(({ quest, x, y }) => {
              const hunt = isHunt(quest);
              const isActive = active?.id === quest.id;
              return (
                <Link key={quest.id} href={`/map?selected=${quest.id}${search ? `&q=${encodeURIComponent(search)}` : ""}`} scroll={false} aria-label={`${quest.title}, ${rewardAmount(quest) ?? "recognition"}`} aria-current={isActive ? "true" : undefined}
                  className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] font-mono text-[11px] font-bold shadow-[0_6px_14px_rgba(17,17,17,0.22)] transition hover:scale-110 ${hunt ? "border-inv" : "border-lime"} ${isActive ? (hunt ? "bg-inv text-on-inv" : "bg-lime text-on-lime") : "bg-surface text-ink"}`}
                  style={{ left: `${x}%`, top: `${y}%` }}>
                  {rewardAmount(quest)?.replace(" NIM", "") ?? "★"}
                </Link>
              );
            })}
            {!pins.length ? <div className="absolute inset-0 grid place-items-center p-6 text-center"><p className="sq-card max-w-sm p-5 text-sm text-ink-2">No bounties with a place yet. Bounties show here when their creator adds a location.</p></div> : null}
            <div className="absolute left-4 top-4 flex gap-2 rounded-full bg-surface/90 px-3 py-2 text-xs font-bold shadow-[var(--shadow-card)] backdrop-blur"><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-lime" />Bounty</span><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-inv" />Hunt</span></div>
          </div>
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
            {active ? (
              <article className="sq-card flex flex-col gap-3 p-5">
                <span className={`sq-sticker self-start ${isHunt(active) ? "sq-sticker-inv" : "sq-sticker-lime"}`}>{isHunt(active) ? `Hunt · ${active.checkpoint_count} stops` : "Bounty"}</span>
                <h2 className="font-display text-[28px] font-black uppercase leading-[0.9] tracking-[-0.04em]">{active.title}</h2>
                <span className="text-sm text-ink-2">{[active.organization_display_name ?? active.creator_display_name, active.location_name].filter(Boolean).join(" · ")}</span>
                <div className="flex items-center justify-between"><span className="font-display text-2xl font-black">{rewardAmount(active) ?? "Glory"}</span><span className="font-mono text-xs font-bold">{Math.max(0, active.max_entries - active.entries_received)}/{active.max_entries} SPOTS</span></div>
                <div className="flex gap-2"><Link href={`/quests/${active.id}`} className="sq-btn sq-btn-lime flex-1">View</Link>{active.latitude !== null ? <a href={`https://www.openstreetmap.org/?mlat=${active.latitude}&mlon=${active.longitude}#map=17/${active.latitude}/${active.longitude}`} target="_blank" rel="noreferrer" className="sq-btn sq-btn-ghost"><ExternalLink size={15} aria-hidden="true" />Directions</a> : null}</div>
              </article>
            ) : null}
            <ol className="sq-card flex flex-col p-2">
              {open.slice(0, 12).map((quest) => (
                <li key={quest.id}><Link href={`/map?selected=${quest.id}`} scroll={false} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-sunken ${active?.id === quest.id ? "bg-lime-tint" : ""}`}><span className="truncate">{quest.title}</span><span className="shrink-0 font-mono text-xs text-ink-2">{quest.location_name ? (quest.distance_km !== null ? `${quest.distance_km.toFixed(1)} KM` : "PIN") : "ONLINE"}</span></Link></li>
              ))}
              {!open.length ? <li className="p-3 text-sm text-ink-2">No open bounties right now.</li> : null}
            </ol>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
