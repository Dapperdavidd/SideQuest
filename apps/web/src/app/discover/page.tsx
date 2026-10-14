import Link from "next/link";
import { Bell, Bookmark, Compass, MapPin, Plus, Search, Sparkles, Trophy, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { QuestCard } from "@/components/quest-card";

const quests = [
  { imageClass: "photo-coffee", title: "Show us your coffee ritual", creator: "Brew & Co.", reward: "$10", entries: "3/5 entries", deadline: "4 days left" },
  { imageClass: "photo-campus", title: "Campus talent hunt", creator: "Uni Lagos", reward: "$30", entries: "2/5 entries", deadline: "6 days left" },
  { imageClass: "photo-run", title: "Weekend run challenge", creator: "Run Club", reward: "$15", entries: "4/10 entries", deadline: "3 days left" },
];

export default function DiscoverPage() {
  return (
    <main className="min-h-screen bg-[#101310] p-3 text-white sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1500px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#151815] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 px-5 py-7 lg:flex lg:flex-col">
          <Logo inverse />
          <nav className="mt-12 space-y-2" aria-label="App navigation">
            <Link className="flex items-center gap-3 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-dark" href="/discover"><Compass size={19} />Discover</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href="#"><Trophy size={19} />Quests</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href="#"><Plus size={19} />Create</Link>
            <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 hover:bg-white/5 hover:text-white" href="#"><UserRound size={19} />Profile</Link>
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center gap-2 text-xs font-bold text-accent"><Sparkles size={14} /> MINI APP READY</div><p className="mt-2 text-xs leading-5 text-white/50">Connect Nimiq Pay only when you are ready to fund or receive a reward.</p></div>
        </aside>
        <section className="min-w-0">
          <header className="flex items-center gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
            <div className="lg:hidden"><Logo inverse /></div>
            <label className="hidden max-w-md flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 sm:flex"><Search size={17} className="text-white/40" /><span className="sr-only">Search quests</span><input className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35" placeholder="Search quests, creators, or places…" /></label>
            <button aria-label="Notifications" className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-white/10"><Bell size={18} /></button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-display font-bold text-dark">H</div>
          </header>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0 px-5 py-7 sm:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-white/45">Good morning, Hannah</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">What will you do today?</h1></div><button className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark">Create a quest</button></div>
              <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{["All", "Friends", "Bounties", "Explore", "Nearby"].map((filter, index) => <button key={filter} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${index === 0 ? "bg-accent text-dark" : "border border-white/10 text-white/60"}`}>{filter}</button>)}</div>
              <article className="photo-sunset mt-5 min-h-[310px] rounded-[1.35rem] bg-cover bg-center p-6 sm:p-8"><div className="flex min-h-[250px] max-w-xl flex-col justify-end"><span className="w-fit rounded-full bg-[#9167ff] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider">Featured explore</span><h2 className="mt-3 font-display text-3xl font-bold">City sunset challenge</h2><p className="mt-2 text-sm text-white/70">Capture the best sunset spot in your city before the light disappears.</p><div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-semibold"><span>$20 reward</span><span>3/5 entries</span><span>1 winner</span><span>6 days left</span></div></div></article>
              <div className="mt-8 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Trending quests</h2><button className="text-sm text-white/50">See all →</button></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{quests.map((quest) => <QuestCard key={quest.title} {...quest} />)}</div>
            </div>
            <aside className="hidden border-l border-white/10 p-6 xl:block">
              <div className="photo-coffee h-52 rounded-[1.25rem] bg-cover bg-center" />
              <div className="mt-5 flex items-start justify-between gap-4"><div><span className="rounded-full bg-[#9167ff] px-2.5 py-1 text-[0.62rem] font-bold uppercase">Bounty</span><h2 className="mt-3 font-display text-2xl font-bold leading-tight">Show us your coffee ritual</h2></div><button aria-label="Save quest" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10"><Bookmark size={18} /></button></div>
              <p className="mt-4 text-sm leading-6 text-white/55">Create a 15–30 second original video showing your coffee ritual at Brew & Co. Be creative and show what makes it special to you.</p>
              <dl className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/10 p-3"><dt className="text-lg font-bold">$10</dt><dd className="text-[0.65rem] text-white/45">per winner</dd></div><div className="rounded-xl border border-white/10 p-3"><dt className="text-lg font-bold">1</dt><dd className="text-[0.65rem] text-white/45">winner</dd></div><div className="rounded-xl border border-white/10 p-3"><dt className="text-lg font-bold">2</dt><dd className="text-[0.65rem] text-white/45">slots left</dd></div></dl>
              <div className="mt-5 flex items-center gap-2 text-sm text-white/60"><MapPin size={16} /> Victoria Island, Lagos</div>
              <button className="mt-6 w-full rounded-xl bg-accent py-3.5 font-bold text-dark">Take this quest</button>
              <p className="mt-3 text-center text-xs text-white/35">Submitting, not joining, uses one of the five entry slots.</p>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
