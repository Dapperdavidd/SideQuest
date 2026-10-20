import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Gift,
  LockKeyhole,
  MapPin,
  Play,
  UsersRound,
} from "lucide-react";
import { Logo } from "@/components/logo";

const featureStrip = [
  { icon: UsersRound, label: "Social challenges" },
  { icon: LockKeyhole, label: "Limited-entry quests" },
  { icon: MapPin, label: "Real-world experiences" },
  { icon: Gift, label: "Rewards & recognition" },
];

const questTypes = [
  {
    icon: UsersRound,
    title: "Friends",
    body: "Create private quests, invite your circle and turn everyday moments into fun competitions.",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1100&q=86",
    iconClass: "bg-[#e8f4aa]",
  },
  {
    icon: BriefcaseBusiness,
    title: "Bounties",
    body: "Local businesses and creators post side quests to engage their communities.",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1100&q=86",
    iconClass: "bg-[#ffd7e1]",
  },
  {
    icon: MapPin,
    title: "Explore",
    body: "Discover new places and complete location-based quests in your city and beyond.",
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1100&q=86",
    iconClass: "bg-[#dbe0ff] text-[#2947ff]",
  },
];

const avatars = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f6f1] text-[#121312]">
      <div className="mx-auto max-w-[1536px] px-5 sm:px-8 lg:px-[5.7rem]">
        <header className="flex h-[4.25rem] items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-10 text-[0.76rem] font-medium lg:flex" aria-label="Primary">
            <Link href="/discover" className="transition-opacity hover:opacity-55">Explore</Link>
            <a href="#ways-to-play" className="transition-opacity hover:opacity-55">For Businesses</a>
            <a href="#ways-to-play" className="transition-opacity hover:opacity-55">How it works</a>
            <a href="#ways-to-play" className="transition-opacity hover:opacity-55">About</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/auth" className="hidden rounded-full border border-black/15 px-5 py-2.5 text-xs font-medium transition hover:bg-white sm:block">Log in</Link>
            <Link href="/discover" className="group flex items-center gap-3 rounded-full bg-[#151615] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-black">
              Get started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </header>

        <section className="grid gap-8 pb-5 pt-5 lg:grid-cols-[40%_60%] lg:gap-12 lg:pt-0">
          <div className="flex flex-col justify-center py-8 lg:py-7">
            <p className="text-[0.63rem] font-bold uppercase tracking-[0.38em] text-black/70">Real people. Real experiences.</p>
            <h1 className="mt-6 max-w-[36rem] font-display text-[clamp(3.55rem,4.3vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.065em]">
              Life comes<br />with <span className="text-[#56604d]">side quests.</span>
            </h1>
            <p className="mt-6 max-w-[31rem] text-[1.04rem] leading-[1.6] tracking-[-0.02em] text-[#666a70]">
              Discover challenges, create experiences, and turn ordinary moments into something more — with friends, your community, or the brands you love.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-5">
              <Link href="/discover" className="group flex min-w-[12.4rem] items-center justify-center gap-3 rounded-full bg-[#151615] px-7 py-4 text-sm font-semibold text-white transition hover:bg-black">
                Get started <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <button className="group flex items-center gap-3 text-left" type="button">
                <span className="grid size-14 place-items-center rounded-full border border-black/25 transition group-hover:bg-white"><Play size={18} fill="currentColor" /></span>
                <span><strong className="block text-sm font-semibold">Watch video</strong><small className="mt-0.5 block text-xs text-black/45">2 min</small></span>
              </button>
            </div>
            <div className="mt-9 flex items-center gap-4">
              <div className="flex -space-x-2.5" aria-hidden="true">
                {avatars.map((avatar) => (
                  <span key={avatar} className="size-10 rounded-full border-2 border-[#f7f6f1] bg-cover bg-center" style={{ backgroundImage: `url(${avatar})` }} />
                ))}
              </div>
              <div><p className="font-display text-xl font-semibold tracking-[-0.04em]">10K+</p><p className="text-[0.68rem] text-black/45">people already on SideQuest</p></div>
            </div>
          </div>

          <div className="relative min-h-[31rem] overflow-hidden rounded-[0.7rem]">
            <div className="absolute inset-0 bg-[url('/images/sidequest-rooftop-hero.webp')] bg-cover bg-center" />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-[#171817]/90 p-3 text-white shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[25rem]">
              <div className="flex items-center gap-3">
                <div className="h-[4.8rem] w-[6.4rem] shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=480&q=84)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Sunset Photo Challenge</p>
                  <p className="mt-1 text-[0.68rem] text-white/65">Capture the best sunset spot in your city.</p>
                  <div className="mt-3 flex items-center gap-4 text-[0.62rem] text-white/80"><span className="text-[#ff9e2f]">● <b className="ml-1 text-white">$10</b></span><span>♧ 3/5 entries</span><span>⌖ 2 days left</span></div>
                </div>
                <Link href="/discover" aria-label="Open Sunset Photo Challenge" className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-black transition hover:scale-105"><ArrowRight size={15} /></Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid border-y border-black/10 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureStrip.map(({ icon: Icon, label }, index) => (
            <div key={label} className={`flex items-center gap-3 px-3 py-2 text-xs ${index ? "lg:border-l lg:border-black/15" : ""}`}><Icon size={19} strokeWidth={1.7} /><span>{label}</span></div>
          ))}
        </div>
      </div>

      <section id="ways-to-play" className="mt-7 rounded-t-[2rem] border-t border-black/[0.04] bg-[#fbfaf7] px-5 pb-16 pt-9 shadow-[0_-16px_60px_rgba(39,38,30,0.03)] sm:px-8 lg:px-[5.7rem]">
        <div className="mx-auto max-w-[1354px]">
          <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex rounded-full bg-black/[0.025] px-3 py-1 text-[0.57rem] font-semibold uppercase tracking-[0.35em] text-black/55">Three ways to play</span>
              <h2 className="mt-4 max-w-[29rem] font-display text-[clamp(2.6rem,3.2vw,3.25rem)] font-semibold leading-[0.94] tracking-[-0.06em]">Different quests.<br />Same adventure.</h2>
            </div>
            <div className="flex items-end justify-between gap-6 pb-1">
              <p className="max-w-[27rem] text-sm leading-6 text-[#666a70]">SideQuest brings together social challenges, brand bounties and real-world experiences. Whether it’s a quick challenge with friends or a creative campaign from your favourite café, there’s always a new side quest waiting.</p>
              <div className="hidden gap-2 sm:flex"><button type="button" aria-label="Previous quest type" className="grid size-10 place-items-center rounded-full bg-black/[0.035] text-black/25"><ArrowLeft size={17} /></button><button type="button" aria-label="Next quest type" className="grid size-10 place-items-center rounded-full border border-black/15"><ArrowRight size={17} /></button></div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {questTypes.map(({ icon: Icon, title, body, image, iconClass }) => (
              <article key={title} className="overflow-hidden rounded-xl border border-black/10 bg-[#f7f6f1]">
                <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(15, 16, 14, 0.12)), url(${image})` }}><span className={`absolute -bottom-5 left-5 grid size-11 place-items-center rounded-full border-4 border-[#f7f6f1] ${iconClass}`}><Icon size={20} strokeWidth={1.8} /></span></div>
                <div className="flex min-h-[6.8rem] items-center gap-5 p-5 pt-6">
                  <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold tracking-[-0.035em]">{title}</h3><p className="mt-1 text-xs leading-5 text-[#666a70]">{body}</p></div>
                  <Link href="/discover" aria-label={`Explore ${title} quests`} className="grid size-10 shrink-0 place-items-center rounded-full border border-black/15 transition hover:bg-white"><ArrowRight size={16} /></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
