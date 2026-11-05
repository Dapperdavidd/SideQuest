"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Compass, Flag, Sparkles, Trophy, UsersRound, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { OpenAppButton } from "@/components/open-app-button";

const radarCards = [
  { kicker: "Hunt · 3 stops", title: ["Three murals", "in Yaba"], detail: "Walk the mural route, scan three hidden QR stops and post your favourite wall.", distance: "2.3 km", reward: "30 NIM", image: "/art/scene-mural-stop.svg", alt: "A painted mural wall with a QR stop sign" },
  { kicker: "Bounty · Video", title: ["Best 15s video", "of Café Neo"], detail: "Shoot fifteen seconds that make people want to sit at the counter.", distance: "1.1 km", reward: "40 NIM", image: "/art/scene-latte.svg", alt: "A latte on a café counter under a neon sign" },
  { kicker: "Photo quest", title: ["Golden hour,", "one frame"], detail: "Catch the last beam of sunlight before it slips behind the city.", distance: "0.8 km", reward: "12 NIM", image: "/art/scene-skyline.svg", alt: "Two friends photographing the sunset over the Lagos skyline" },
] as const;

const modes = [
  { mode: "Mode one", chip: "Friends", title: "With your people", copy: "Dares and plans for your crew. Cook-offs, photo recreations, sunset runs. Your room votes the winner.", image: "/art/mode-friends.jpg", alt: "Four friends arm in arm watching cable cars", href: "/friends", icon: UsersRound },
  { mode: "Mode two", chip: "Bounties", title: "For the reward", copy: "Small creative jobs from local spots. Seven entries max, real NIM for the best.", image: "/art/mode-bounties.jpg", alt: "Three hands toasting coffee cups", href: "/discover", icon: Trophy },
  { mode: "Any quest", chip: "Hunts", title: "Out in the world", copy: "Turn any quest into a scavenger hunt with QR stops across the city. Walk it, scan it, win it.", image: "/art/mode-hunts.jpg", alt: "Misty mountain ridges at dusk", href: "/map", icon: Compass },
] as const;

export function LandingExperience() {
  return (
    <main className="overflow-hidden bg-[#111111] font-sans text-white">
      <Hero />
      <QuestRadar />
      <Modes />
      <Finale />
      <footer className="flex flex-wrap items-center justify-between gap-5 border-t border-white/10 px-[clamp(20px,6vw,88px)] py-10 text-sm text-[#8c8c95]">
        <span className="font-display text-2xl font-black tracking-[-0.05em] text-white">sidequest<span className="text-lime">.</span></span>
        <span>Made in Lagos · Rewards run on Nimiq testnet. Testnet NIM has no cash value.</span>
        <span className="flex gap-6 font-semibold text-[#d8d8dc]"><Link href="/coming-soon">Terms</Link><Link href="/coming-soon">Privacy</Link><Link href="/profile">For businesses</Link></span>
      </footer>
    </main>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  return (
    <section aria-label="Hero" className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <img src="/art/hero-rooftop.jpg" alt="Friends laughing on a Lagos rooftop at sunset" className="absolute inset-0 h-full w-full object-cover object-[60%_35%]" />
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,17,17,0.82)_0%,rgba(17,17,17,0.45)_45%,rgba(17,17,17,0.15)_100%)]" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[420px] bg-[linear-gradient(rgba(17,17,17,0),#111111)]" />
      <header className="relative flex flex-wrap items-center justify-between gap-6 px-[clamp(20px,6vw,88px)] pt-10">
        <Link href="/" className="font-display text-[30px] font-black tracking-[-0.05em]">sidequest<span className="text-lime">.</span></Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-9">
          <a href="#modes" className="hidden text-xs font-bold tracking-[0.22em] text-[#d8d8dc] sm:block">THREE WAYS</a>
          <OpenAppButton className="flex h-[52px] items-center gap-3 rounded-full border border-white/30 bg-[#111111]/35 px-[26px] text-xs font-extrabold uppercase tracking-[0.2em] backdrop-blur" />
        </nav>
      </header>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="sq-glass relative mx-5 mt-16 flex w-[min(400px,calc(100%-40px))] flex-col gap-3.5 rounded-[22px] px-5 pb-4 pt-[18px] shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:ml-[clamp(20px,3.5vw,56px)] lg:mt-[150px]"
        role="status"
      >
        <div className="flex items-center gap-3.5">
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-[#F19D71] text-[#111111]"><UsersRound size={22} aria-hidden="true" /></span>
          <div className="flex flex-1 flex-col gap-1"><span className="text-[11px] font-extrabold tracking-[0.2em] text-[#F19D71]">FRIENDS QUEST</span><span className="text-base font-semibold">Amara challenged you.</span></div>
          <span className="self-start text-[11px] text-[#9a9aa2]">now</span>
        </div>
        <span className="h-px bg-white/12" />
        <span className="text-[13px] text-[#c9c9ce]">Golden-hour portrait · 20 min</span>
      </motion.div>

      <div className="relative mt-auto flex flex-col gap-[22px] px-[clamp(20px,6vw,88px)] pt-16 lg:pt-[90px]">
        <span className="flex items-center gap-3 text-xs font-bold tracking-[0.3em] text-[#d8d8dc]"><span className="h-2.5 w-2.5 rounded-full bg-lime" />A NEW ADVENTURE IS NEARBY</span>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <h1 className="font-display text-[clamp(64px,11vw,168px)] font-black uppercase leading-[0.86] tracking-[-0.065em]">Life comes<br /><span className="pl-[0.92em]">with side</span><br /><span className="text-lime">quests.</span></h1>
          <Link href="/discover" className="grid h-[132px] w-[132px] shrink-0 place-items-center content-center gap-1.5 rounded-full bg-lime text-sm font-extrabold tracking-[0.24em] text-[#111111] shadow-[0_20px_50px_rgba(224,254,94,0.25)] transition hover:scale-105 sm:h-[152px] sm:w-[152px]">Enter<ArrowRight size={20} strokeWidth={2.4} aria-hidden="true" /></Link>
        </div>
        <span className="mt-[18px] h-px bg-white/14" />
        <div className="flex flex-wrap items-end justify-between gap-5 pb-12">
          <p className="max-w-[440px] text-[19px] leading-normal text-[#d0d0d5]">Turn the plans you nearly skipped into the stories you keep telling.</p>
          <a href="#radar" className="flex items-center gap-2.5 text-xs font-bold tracking-[0.26em] text-[#b9b9bf]">SCROLL TO PLAY <ArrowDown size={16} className="animate-bounce" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}

function QuestRadar() {
  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const order = radarCards.map((_, offset) => radarCards[(index + offset) % radarCards.length]);
  const top = order[0];

  const decline = () => { setAccepted(null); setIndex((value) => (value + 1) % radarCards.length); };
  const accept = () => setAccepted(top.title.join(" "));

  return (
    <section id="radar" aria-label="Quest radar" className="relative flex scroll-mt-6 flex-wrap items-center gap-16 bg-[#111111] px-[clamp(20px,6vw,88px)] py-[clamp(80px,10vw,140px)]">
      <div className="flex flex-[1_1_420px] flex-col gap-[30px]">
        <span className="text-[13px] font-extrabold tracking-[0.3em] text-lime">QUEST RADAR / LIVE</span>
        <h2 className="font-display text-[clamp(56px,8vw,120px)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Your<br />move.<br /><span className="text-lime">Pick a<br />side.</span></h2>
        <p className="max-w-[500px] text-lg leading-relaxed text-[#bdbdc3]">Every ping is a choice. Swipe left to decline. Swipe right to accept the quest and step into the story.</p>
        <div className="flex flex-wrap gap-3.5">
          <button type="button" onClick={decline} aria-label="Decline quest" className="flex h-[50px] items-center gap-3 rounded-full border border-white/30 px-[26px] text-[13px] font-extrabold tracking-[0.2em] transition hover:bg-white/5"><X size={18} aria-hidden="true" />DECLINE</button>
          <button type="button" onClick={accept} aria-label="Accept quest" className="flex h-[50px] items-center gap-3 rounded-full bg-lime px-7 text-[13px] font-extrabold tracking-[0.2em] text-[#111111] transition hover:-translate-y-0.5"><Check size={18} strokeWidth={2.6} aria-hidden="true" />ACCEPT</button>
        </div>
        <p aria-live="polite" className="min-h-6 text-sm font-semibold text-[#d8d8dc]">{accepted ? <>Accepted <span className="text-lime">{accepted}</span>. <Link href="/discover" className="underline underline-offset-4">Find it on Discover</Link></> : null}</p>
      </div>
      <div className="flex flex-[1_1_520px] flex-col gap-[26px] rounded-[44px] border border-white/12 bg-[rgba(40,40,44,0.55)] px-[26px] pb-14 pt-[26px] shadow-[0_40px_90px_rgba(0,0,0,0.45)]">
        <div className="flex justify-between px-3 pt-1.5 text-[11px] font-extrabold tracking-[0.24em] text-[#8c8c95]"><span>DECLINE ←</span><span className="font-mono">{index + 1} / {radarCards.length}</span><span>→ ACCEPT</span></div>
        <div className="relative mx-1.5 h-[min(540px,120vw)]">
          {[...order].reverse().map((card, reversedIndex) => {
            const depth = order.length - 1 - reversedIndex;
            const pose = [
              { left: "auto", right: "0%", top: 34, width: "64%", height: "87%", rotate: 2.4 },
              { left: "17%", right: "auto", top: 14, width: "58%", height: "81%", rotate: -3 },
              { left: "0%", right: "auto", top: 50, width: "58%", height: "78%", rotate: -8 },
            ][depth];
            const isTop = depth === 0;
            return (
                <motion.div
                  key={card.title.join()}
                  layout={!reduce}
                  drag={isTop && !reduce ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => { if (info.offset.x > 120) accept(); else if (info.offset.x < -120) decline(); }}
                  animate={{ rotate: pose.rotate }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  className={`absolute flex flex-col justify-end gap-3.5 overflow-hidden rounded-[28px] bg-[#1e1e22] p-7 shadow-[0_24px_50px_rgba(0,0,0,0.45)] ${isTop ? "cursor-grab active:cursor-grabbing" : ""}`}
                  style={{ left: pose.left, right: pose.right, top: pose.top, width: pose.width, height: pose.height }}
                >
                  <img src={card.image} alt={card.alt} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                  <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0)_30%,rgba(17,17,17,0.92)_82%)]" />
                  <span className="absolute left-6 top-6 rounded-full border border-white/20 bg-[#111111]/45 px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#f4f4f2]">{card.kicker}</span>
                  <div className={`relative font-display font-black uppercase leading-[0.9] tracking-[-0.05em] text-[#f4f4f2] ${isTop ? "text-[clamp(34px,4.4vw,56px)]" : "text-[clamp(24px,2.6vw,34px)]"}`}>{card.title[0]}<br />{card.title[1]}</div>
                  {isTop ? <>
                    <p className="relative text-base text-[#c9c9ce]">{card.detail}</p>
                    <div className="relative flex gap-2.5"><span className="rounded-full bg-[#2c2c30] px-4 py-2.5 text-[15px] font-bold text-[#f4f4f2]">{card.distance}</span><span className="rounded-full bg-lime px-4 py-2.5 font-mono text-[15px] font-bold text-[#111111]">{card.reward}</span></div>
                  </> : null}
                </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Modes() {
  return (
    <section id="modes" aria-label="Three ways to play" className="flex scroll-mt-6 flex-col gap-12 bg-white px-[clamp(20px,6vw,88px)] pb-[140px] pt-[clamp(90px,10vw,150px)] text-[#111111]">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex flex-col gap-[26px]">
          <span className="text-[13px] font-extrabold tracking-[0.3em] text-[#6b6c73]">PICK YOUR MODE</span>
          <h2 className="font-display text-[clamp(56px,8vw,116px)] font-black uppercase leading-[0.88] tracking-[-0.06em]">Three ways<br />to play.</h2>
        </div>
        <p className="max-w-[430px] text-lg leading-relaxed text-[#55565c]">No streaks to protect. No endless feed. Just a reason to get up, go out and do something worth remembering.</p>
      </div>
      <span className="h-px bg-[#e7e7ea]" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-[22px]">
        {modes.map(({ mode, chip, title, copy, image, alt, href, icon: Icon }) => (
          <Link key={chip} href={href} className="group relative flex h-[clamp(440px,48vw,560px)] flex-col justify-between overflow-hidden rounded-[30px] p-[30px] text-white">
            <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0.15)_30%,rgba(17,17,17,0.88)_100%)]" />
            <div className="relative flex items-center justify-between"><span className="text-xs font-extrabold uppercase tracking-[0.26em]">{mode}</span><span className="grid h-[50px] w-[50px] place-items-center rounded-full border border-white/25 bg-[#111111]/45"><Icon size={20} aria-hidden="true" /></span></div>
            <div className="relative flex flex-col gap-3.5">
              <span className="self-start rounded-full bg-lime px-3.5 py-[7px] text-xs font-extrabold uppercase tracking-[0.2em] text-[#111111]">{chip}</span>
              <span className="font-display text-[40px] font-black uppercase leading-[0.92] tracking-[-0.05em]">{title}</span>
              <span className="text-[15px] leading-normal text-[#d0d0d5]">{copy}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Finale() {
  return (
    <section aria-label="Start" className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-[120px] text-center">
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-[990px] w-[990px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime/20" />
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-[724px] w-[724px] -translate-x-1/2 -translate-y-1/2 animate-[spin_80s_linear_infinite] rounded-full border border-dashed border-lime/30" />
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime/12" />
      <span aria-hidden="true" className="absolute left-[8%] top-[17%] hidden -rotate-[9deg] font-display text-[40px] font-black tracking-[-0.02em] text-lime md:block">GO THIS WAY</span>
      <span aria-hidden="true" className="absolute right-[8%] top-[19%] hidden h-[46px] items-center rounded-full border border-[#2c2c30] px-6 text-[11px] font-extrabold tracking-[0.3em] text-[#8c8c95] md:flex">SIDE QUEST / 001</span>
      <span aria-hidden="true" className="absolute bottom-[20%] left-[12%] hidden -rotate-[4deg] items-center gap-3 text-xs font-extrabold tracking-[0.24em] text-lime md:flex"><Sparkles size={16} />COLLECT THE STORY</span>
      <span aria-hidden="true" className="absolute bottom-[25%] right-[12%] hidden h-[76px] w-[76px] place-items-center rounded-full border border-[#3a3a3f] text-lime md:grid"><Flag size={26} /></span>
      <span aria-hidden="true" className="absolute bottom-[10%] right-[22%] hidden -rotate-3 font-display text-3xl font-black text-[#3a3a3f] md:block">SAY YES →</span>
      <h2 className="relative font-display text-[clamp(56px,9vw,140px)] font-black uppercase leading-[0.86] tracking-[-0.065em] text-[#f4f4f2]">Your next<br />story<br /><span className="text-lime">is out there.</span></h2>
      <p className="relative mt-[38px] text-lg text-[#a1a1aa]">Pick a quest nearby, or dare your friends to one.</p>
      <Link href="/discover" className="relative mt-10 flex min-h-[72px] items-center gap-[18px] rounded-full bg-lime px-10 text-[15px] font-extrabold uppercase tracking-[0.22em] text-[#111111] transition hover:-translate-y-0.5">Start your first side quest<ArrowRight size={20} strokeWidth={2.4} aria-hidden="true" /></Link>
    </section>
  );
}
