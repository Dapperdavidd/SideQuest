import Link from "next/link";
import { Bell, Compass, Gift, Map, Plus, Swords, UserRound, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export type AppSection = "discover" | "map" | "friends" | "quests" | "create" | "notifications" | "wallet" | "profile";

type AppShellProps = {
  active: AppSection;
  children: React.ReactNode;
  viewer?: { displayName: string; avatarUrl?: string | null; username?: string | null } | null;
  unreadNotifications?: number;
};

const railItems = [
  { key: "discover", label: "Discover", href: "/discover", icon: Compass, guest: true },
  { key: "map", label: "Map", href: "/map", icon: Map, guest: true },
  { key: "friends", label: "Friends", href: "/friends", icon: UsersRound, guest: false },
  { key: "quests", label: "My quests", href: "/quests", icon: Swords, guest: false },
  { key: "notifications", label: "Inbox", href: "/notifications", icon: Bell, guest: false },
  { key: "wallet", label: "Rewards", href: "/wallet", icon: Gift, guest: false },
  { key: "profile", label: "Profile", href: "/profile", icon: UserRound, guest: false },
] as const;

export function AppShell({ active, children, viewer = null, unreadNotifications = 0 }: AppShellProps) {
  const signedIn = Boolean(viewer);
  const route = (href: string, guest = false) => (signedIn || guest ? href : `/auth?next=${encodeURIComponent(href)}`);
  const unreadLabel = unreadNotifications > 99 ? "99+" : String(unreadNotifications);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <nav aria-label="Main" className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line bg-surface px-5 pb-7 pt-[30px] lg:flex">
          <div className="px-2 pb-7"><Logo size="lg" href="/discover" /></div>
          {railItems.map(({ key, label, href, icon: Icon, guest }) => {
            const selected = active === key;
            return (
              <Link key={key} href={route(href, guest)} className="sq-nav-item" aria-current={selected ? "page" : undefined}>
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {label}
                {selected ? <span aria-hidden="true" className="ml-auto h-[7px] w-[7px] rounded-full bg-lime" /> : null}
                {key === "notifications" && unreadNotifications && !selected ? (
                  <span className="ml-auto grid h-[22px] min-w-[22px] rotate-6 place-items-center rounded-full bg-lime px-1.5 font-mono text-[11px] font-bold tracking-normal text-on-lime" aria-label={`${unreadLabel} unread`}>{unreadLabel}</span>
                ) : null}
              </Link>
            );
          })}
          <Link href={route("/create")} className="sq-btn sq-btn-lime mt-[18px] h-14" aria-current={active === "create" ? "page" : undefined}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />Create quest
          </Link>
          <div className="mt-auto flex items-center gap-3 px-2 pt-6">
            {viewer ? (
              <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={viewer.displayName} url={viewer.avatarUrl} tilt={-6} ring />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold">{viewer.displayName}</span>
                  {viewer.username ? <span className="truncate font-mono text-[11px] font-semibold text-ink-2">@{viewer.username}</span> : null}
                </span>
              </Link>
            ) : (
              <Link href="/auth" className="sq-btn sq-btn-ghost flex-1 !min-h-11 !text-[11px]">Sign in</Link>
            )}
            <ThemeToggle />
          </div>
        </nav>

        <div className="min-w-0 flex-1 pb-28 lg:pb-0">
          <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-line bg-bg/90 px-5 backdrop-blur-xl lg:hidden">
            <Logo size="sm" href="/discover" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href={route("/notifications")} aria-label={unreadNotifications ? `Inbox, ${unreadLabel} unread` : "Inbox"} className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-surface">
                <Bell size={19} aria-hidden="true" />
                {unreadNotifications ? <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-bg bg-inv px-1 font-mono text-[10px] font-bold text-on-inv">{unreadLabel}</span> : null}
              </Link>
            </div>
          </header>
          {children}
        </div>
      </div>

      <nav aria-label="Main" className="sq-tabbar fixed inset-x-4 bottom-3 z-50 grid h-16 grid-cols-5 items-center rounded-full px-1.5 lg:hidden">
        <TabLink href="/discover" label="Discover" selected={active === "discover" || active === "map"}><Compass size={20} aria-hidden="true" /></TabLink>
        <TabLink href={route("/friends")} label="Friends" selected={active === "friends"}><UsersRound size={20} aria-hidden="true" /></TabLink>
        <Link href={route("/create")} aria-label="Create a quest" className="grid h-12 w-12 place-items-center justify-self-center rounded-full bg-lime text-on-lime"><Plus size={22} strokeWidth={2.4} aria-hidden="true" /></Link>
        <TabLink href={route("/quests")} label="My quests" selected={active === "quests"}><Swords size={20} aria-hidden="true" /></TabLink>
        <TabLink href={signedIn ? "/profile" : "/auth"} label={signedIn ? "Profile" : "Sign in"} selected={active === "profile" || active === "wallet"}>
          {viewer ? <Avatar name={viewer.displayName} url={viewer.avatarUrl} size={22} /> : <UserRound size={20} aria-hidden="true" />}
        </TabLink>
      </nav>
    </div>
  );
}

function TabLink({ href, label, selected, children }: { href: string; label: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={selected ? "page" : undefined} className={`flex flex-col items-center gap-[3px] text-[10px] tracking-[0.04em] text-on-inv ${selected ? "font-bold" : "pb-2 font-semibold opacity-65"}`}>
      {children}
      {label}
      {selected ? <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-lime" /> : null}
    </Link>
  );
}
