import { Suspense } from "react";
import { Search } from "lucide-react";
import { MapExplorer } from "@/components/map/map-explorer";
import { AppShell } from "@/components/app-shell";
import { getUnreadNotificationCount, listQuests, type Quest } from "@/lib/api/quests";
import { getViewerForUser } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Map" };

export default function MapPage(props: PageProps<"/map">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><MapContent {...props} /></Suspense>;
}

async function MapContent({ searchParams }: PageProps<"/map">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.slice(0, 80) : "";
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [viewer, quests, unread] = await Promise.all([
    session?.user ? getViewerForUser(supabase, session.user) : Promise.resolve(null),
    listQuests({ questType: "BOUNTY", search }, session?.access_token).catch(() => [] as Quest[]),
    session ? getUnreadNotificationCount(session.access_token) : Promise.resolve(0),
  ]);
  const open = quests.filter((quest) => quest.status === "OPEN");

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
        <MapExplorer quests={open} />
      </div>
    </AppShell>
  );
}
