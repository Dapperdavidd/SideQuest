import Link from "next/link";
import { Bell, Compass, Plus, Sparkles, Trophy, UserRound, WalletCards } from "lucide-react";
import { Logo } from "@/components/logo";

export type AppSection = "discover" | "quests" | "create" | "notifications" | "wallet" | "profile";

type AppShellProps = {
  active: AppSection;
  children: React.ReactNode;
  viewer?: { displayName: string; avatarUrl?: string | null } | null;
  unreadNotifications?: number;
};

const primaryItems = [
  { key: "discover", label: "Explore", href: "/discover", icon: Compass },
  { key: "quests", label: "My quests", href: "/quests", icon: Trophy },
  { key: "create", label: "Create", href: "/create", icon: Plus },
  { key: "notifications", label: "Inbox", href: "/notifications", icon: Bell },
] as const;

export function AppShell({ active, children, viewer = null, unreadNotifications = 0 }: AppShellProps) {
  const signedIn = Boolean(viewer);
  const firstName = viewer?.displayName.split(/\s+/)[0] || "Explorer";
  const initial = firstName.charAt(0).toUpperCase();
  const destination = (href: string) => signedIn || href === "/discover" ? href : `/auth?next=${href}`;

  return (
    <main className="app-canvas min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="app-rail hidden w-[248px] shrink-0 flex-col px-5 py-7 lg:flex">
          <Logo inverse />
          <p className="mt-3 max-w-[150px] text-xs leading-5 text-white/42">Make today a story worth telling.</p>
          <nav className="mt-10 space-y-1.5" aria-label="Main navigation">
            {primaryItems.map(({ key, label, href, icon: Icon }) => {
              const selected = active === key;
              return <Link key={key} href={destination(href)} className={`app-nav-item ${selected ? "app-nav-item-active" : ""}`} aria-current={selected ? "page" : undefined}><Icon size={19} /><span>{label}</span>{key === "notifications" && unreadNotifications ? <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[0.62rem] font-extrabold text-dark">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}</Link>;
            })}
          </nav>
          <div className="my-5 h-px bg-white/8" />
          <Link href={destination("/wallet")} className={`app-nav-item ${active === "wallet" ? "app-nav-item-active" : ""}`}><WalletCards size={19} /><span>Rewards</span></Link>
          <Link href={signedIn ? "/profile" : "/auth"} className={`app-nav-item ${active === "profile" ? "app-nav-item-active" : ""}`}><UserRound size={19} /><span>{signedIn ? "Profile" : "Sign in"}</span></Link>
          <div className="mt-auto rounded-[1.4rem] border border-white/10 bg-white/[0.055] p-4">
            <span className="flex items-center gap-2 text-[0.68rem] font-extrabold uppercase tracking-[0.13em] text-accent"><Sparkles size={14} />New here?</span>
            <p className="mt-2 text-xs leading-5 text-white/50">Choose something fun, join in, then share what you did.</p>
            <Link href="/discover#how-it-works" className="mt-3 inline-flex text-xs font-bold text-white underline decoration-white/30 underline-offset-4">See how it works</Link>
          </div>
        </aside>

        <section className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="app-mobile-header sticky top-0 z-40 flex items-center justify-between px-5 py-4 lg:hidden">
            <Logo />
            <Link href={signedIn ? "/profile" : "/auth"} aria-label={signedIn ? "Open profile" : "Sign in"} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-dark font-bold text-white">{viewer?.avatarUrl ? <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}</Link>
          </header>
          {children}
        </section>
      </div>

      <nav className="app-bottom-nav fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[1.35rem] p-1.5 lg:hidden" aria-label="Mobile navigation">
        {primaryItems.map(({ key, label, href, icon: Icon }) => {
          const selected = active === key;
          return <Link key={key} href={destination(href)} className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.62rem] font-bold ${selected ? "bg-accent text-dark" : "text-white/58"}`} aria-current={selected ? "page" : undefined}><Icon size={19} /><span>{label}</span>{key === "notifications" && unreadNotifications ? <span className="absolute right-[23%] top-1.5 h-2 w-2 rounded-full bg-[#ff6b57]" /> : null}</Link>;
        })}
      </nav>
    </main>
  );
}
