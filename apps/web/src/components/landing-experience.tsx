"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Camera,
  Coffee,
  Compass,
  Footprints,
  Map,
  Sparkles,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { QuestNotificationBanner } from "@/components/quest-notification-banner";

const questModes = [
  {
    number: "01",
    title: "With your people",
    label: "Friends",
    description: "Drop a challenge into the group chat and make the ordinary competitive.",
    icon: UsersRound,
    className: "landing-card-friends",
  },
  {
    number: "02",
    title: "For the reward",
    label: "Bounties",
    description: "Complete creative quests from local brands, creators and communities.",
    icon: Trophy,
    className: "landing-card-bounty",
  },
  {
    number: "03",
    title: "Out in the world",
    label: "Explore",
    description: "Follow the pin, discover a place and come back with a story.",
    icon: Compass,
    className: "landing-card-explore",
  },
] as const;

const heroNotifications = [
  { eyebrow: "New side quest", title: "Catch the last light.", detail: "Rooftop lookout · 0.8 km", icon: Zap, accent: "#d8ff32", position: "right-[4vw] top-[17vh]", delay: 0.5 },
  { eyebrow: "Friends quest", title: "Amara challenged you.", detail: "Golden-hour portrait · 20 min", icon: Camera, accent: "#ff9868", position: "left-[3vw] top-[22vh]", delay: 2.7 },
  { eyebrow: "Quest nearby", title: "Coffee crawl starts soon.", detail: "Three stops · 15 NIM", icon: Coffee, accent: "#f2d4a8", position: "right-[5vw] bottom-[21vh]", delay: 4.9 },
  { eyebrow: "Squad update", title: "Two friends just joined.", detail: "Night ride · Meet at 9:00", icon: Bike, accent: "#9ae6ff", position: "left-[5vw] bottom-[20vh]", delay: 7.1 },
] as const;

const activityTokens = [
  { icon: Camera, color: "#d8ff32", label: "Photo", top: 2, duration: 8.2, delay: 0.3 },
  { icon: Bike, color: "#9ae6ff", label: "Ride", top: 30, duration: 10.4, delay: 1.7 },
  { icon: Coffee, color: "#ff9868", label: "Coffee", top: 58, duration: 9.1, delay: 3.2 },
  { icon: Map, color: "#f4f0e7", label: "Explore", top: 86, duration: 11.8, delay: 4.5 },
  { icon: Footprints, color: "#d8ff32", label: "Walk", top: 114, duration: 9.8, delay: 6.1 },
] as const;

const swipeQuests = [
  { title: "Golden hour, one frame", kicker: "Photo quest", detail: "Catch the last beam of sunlight before it slips behind the city.", reward: "12 NIM", distance: "0.8 km", className: "landing-card-explore" },
  { title: "The café nobody knows", kicker: "Discovery quest", detail: "Follow three clues and order the drink waiting at the final stop.", reward: "15 NIM", distance: "1.4 km", className: "landing-card-bounty" },
  { title: "A stranger picks the route", kicker: "Friends quest", detail: "Let the group vote. Take the winning path without checking the map.", reward: "8 NIM", distance: "2.1 km", className: "landing-card-friends" },
] as const;

export function LandingExperience() {
  const heroRef = useRef<HTMLElement>(null);
  const dispatchRef = useRef<HTMLElement>(null);
  const modesRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const heroIsVisible = useInView(heroRef, { amount: 0.12 });
  const dispatchIsVisible = useInView(dispatchRef, { amount: 0.12 });
  const modesAreVisible = useInView(modesRef, { amount: 0.12 });
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);
  const [activeMode, setActiveMode] = useState(0);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const { scrollYProgress: dispatchProgress } = useScroll({
    target: dispatchRef,
    offset: ["start end", "end start"],
  });
  const heroY = useTransform(heroProgress, [0, 1], [0, 180]);
  const heroScale = useTransform(heroProgress, [0, 1], [1.04, 1.18]);
  const heroOpacity = useTransform(heroProgress, [0, 0.82], [1, 0]);
  const deckY = useTransform(dispatchProgress, [0.08, 0.45, 0.85], [60, 0, -30]);

  const advanceSwipe = (direction: 1 | -1) => {
    setSwipeDirection(direction);
    setSwipeIndex((current) => (current + 1) % swipeQuests.length);
  };

  useEffect(() => {
    if (prefersReducedMotion || !dispatchIsVisible) return;
    const swipeTimer = window.setInterval(() => {
      setSwipeDirection((current) => (current === 1 ? -1 : 1));
      setSwipeIndex((current) => (current + 1) % swipeQuests.length);
    }, 2200);
    return () => window.clearInterval(swipeTimer);
  }, [dispatchIsVisible, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !modesAreVisible) return;
    const modeTimer = window.setInterval(() => {
      setActiveMode((current) => (current + 1) % questModes.length);
    }, 1400);
    return () => window.clearInterval(modeTimer);
  }, [modesAreVisible, prefersReducedMotion]);

  return (
    <main className="overflow-clip bg-[#0b0c0a] text-[#f6f3e9]">
      <section ref={heroRef} className="relative min-h-[100svh] overflow-hidden" aria-labelledby="landing-title">
        <motion.div
          aria-hidden="true"
          className="absolute -inset-6 bg-[url('/images/sidequest-rooftop-hero.webp')] bg-cover bg-center"
          style={prefersReducedMotion ? undefined : { y: heroY, scale: heroScale }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,7,.47)_0%,rgba(7,8,7,.16)_37%,rgba(7,8,7,.78)_83%,#0b0c0a_100%)]" />
        <div aria-hidden="true" className="landing-noise absolute inset-0 opacity-25" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_76%_31%,rgba(216,255,50,.13),transparent_24%)]" />

        <header className="absolute inset-x-0 top-0 z-30 mx-auto flex h-24 max-w-[1540px] items-center justify-between px-5 sm:px-9 lg:px-14">
          <Link href="/" aria-label="SideQuest home" className="font-display text-xl font-extrabold tracking-[-0.07em] text-white sm:text-2xl">
            sidequest<span className="text-[#d8ff32]">.</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#how-it-plays" className="hidden rounded-full px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:text-white sm:block">
              How it plays
            </a>
            <Link href="/coming-soon" className="group flex items-center gap-3 rounded-full border border-white/30 bg-black/20 px-4 py-3 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md transition hover:border-[#d8ff32] hover:bg-[#d8ff32] hover:text-black sm:px-5">
              Open app <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </header>

        <motion.div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-5 pb-9 pt-32 sm:px-9 sm:pb-12 lg:px-14 lg:pb-14" style={prefersReducedMotion ? undefined : { opacity: heroOpacity }}>
          <div className="mx-auto flex w-full max-w-[1428px] items-end justify-between gap-12">
            <div>
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="mb-5 flex items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.3em] text-white/65"
              >
                <span className="inline-block size-2 rounded-full bg-[#d8ff32] shadow-[0_0_18px_#d8ff32]" />
                A new adventure is nearby
              </motion.p>
              <h1 id="landing-title" className="font-display text-[clamp(4rem,10.4vw,10.7rem)] font-black uppercase leading-[0.76] tracking-[-0.085em] text-white">
                <motion.span className="block" initial={prefersReducedMotion ? false : { y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.85, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}>Life comes</motion.span>
                <motion.span className="block pl-[7vw]" initial={prefersReducedMotion ? false : { y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.85, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}>with side</motion.span>
                <motion.span className="block text-[#d8ff32]" initial={prefersReducedMotion ? false : { y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.85, delay: 0.27, ease: [0.16, 1, 0.3, 1] }}>quests.</motion.span>
              </h1>
            </div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.75, type: "spring" }}
              className="mb-4 hidden lg:block"
            >
              <Link href="/discover" className="group relative grid size-32 shrink-0 place-items-center rounded-full bg-[#d8ff32] text-black transition hover:scale-105">
                <span className="text-center text-xs font-black uppercase tracking-[0.2em]">Enter</span>
                <ArrowRight className="absolute mt-9 transition-transform group-hover:translate-x-2" size={18} />
              </Link>
            </motion.div>
          </div>

          <div className="mx-auto mt-8 flex w-full max-w-[1428px] items-end justify-between gap-6 border-t border-white/20 pt-5">
            <p className="max-w-sm text-sm leading-6 text-white/66 sm:text-base">Turn the plans you nearly skipped into the stories you keep telling.</p>
            <Link href="/discover" className="flex items-center gap-3 rounded-full bg-[#d8ff32] px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-black lg:hidden">Enter <ArrowRight size={15} /></Link>
            <div className="hidden items-center gap-3 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/50 sm:flex"><span>Scroll to play</span><ArrowRight size={14} className="rotate-90 landing-bounce" /></div>
          </div>
        </motion.div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 hidden md:block">
          {heroNotifications.map(({ position, delay, ...notification }, index) => (
            <motion.div
              key={notification.title}
              className={`absolute ${position}`}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88, x: index % 2 === 0 ? 50 : -50 }}
              animate={prefersReducedMotion && index === 0 ? { opacity: 1 } : prefersReducedMotion || !heroIsVisible ? { opacity: 0 } : { opacity: [0, 1, 1, 0], scale: [0.88, 1, 1, 0.96], x: [index % 2 === 0 ? 50 : -50, 0, 0, index % 2 === 0 ? -18 : 18], y: [10, 0, 0, -12] }}
              transition={{ duration: 2.1, delay, repeat: prefersReducedMotion ? 0 : Infinity, repeatDelay: 6.7, times: [0, 0.15, 0.78, 1], ease: "easeOut" }}
            >
              <QuestNotificationBanner {...notification} />
            </motion.div>
          ))}
        </div>

        <div aria-hidden="true" className="absolute bottom-[18%] left-0 z-[5] hidden h-40 w-full overflow-hidden opacity-85 sm:block">
          {activityTokens.map(({ icon: Icon, color, label, top, duration, delay }) => (
            <motion.div
              key={label}
              className="absolute right-0 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-2 shadow-xl backdrop-blur"
              animate={prefersReducedMotion || !heroIsVisible ? undefined : { x: ["12vw", "-112vw"], y: [0, -5, 3, -4, 0] }}
              transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
              style={{ color, top }}
            >
              <Icon size={15} />
              <span className="text-[0.52rem] font-black uppercase tracking-[0.18em]">{label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="dispatch" ref={dispatchRef} className="relative min-h-[105svh] bg-[#090a09] text-white">
        <div className="flex min-h-[105svh] items-center overflow-hidden px-5 py-24 sm:px-9 lg:px-14">
          <div aria-hidden="true" className="absolute inset-0 scale-105 bg-[url('/images/sidequest-rooftop-hero.webp')] bg-cover bg-center opacity-25" />
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,rgba(216,255,50,.13),transparent_30%),linear-gradient(90deg,rgba(8,9,8,.95),rgba(8,9,8,.72),rgba(8,9,8,.9))]" />
          <div aria-hidden="true" className="landing-noise absolute inset-0 opacity-20" />
          <div className="relative mx-auto grid w-full max-w-[1428px] items-center gap-14 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} className="text-[0.65rem] font-black uppercase tracking-[0.32em] text-[#d8ff32]">Quest radar / live</motion.p>
              <motion.h2 initial={{ opacity: 0, y: 45 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7 }} className="mt-7 max-w-[42rem] font-display text-[clamp(4rem,7vw,7.7rem)] font-black uppercase leading-[0.82] tracking-[-0.075em]">
                Your move.<br /><span className="text-[#d8ff32]">Pick a side.</span>
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.25 }} className="mt-8 max-w-md text-base leading-7 text-white/60">Every ping is a choice. Swipe left to decline. Swipe right to accept the quest and step into the story.</motion.p>
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => advanceSwipe(-1)} className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/65 backdrop-blur-xl transition hover:bg-white/15" aria-label="Decline quest">← Decline</button>
                <button type="button" onClick={() => advanceSwipe(1)} className="rounded-full bg-[#d8ff32] px-5 py-3 text-[0.62rem] font-black uppercase tracking-[0.18em] text-black transition hover:scale-105" aria-label="Accept quest">Accept →</button>
              </div>
            </div>

            <motion.div className="relative mx-auto h-[34rem] w-full max-w-[43rem]" style={prefersReducedMotion ? undefined : { y: deckY }}>
              <div aria-hidden="true" className="absolute inset-x-[9%] top-[8%] h-[82%] rotate-[-5deg] rounded-[2.3rem] border border-white/10 bg-white/[0.055]" />
              <div aria-hidden="true" className="absolute inset-x-[9%] top-[8%] h-[82%] rotate-[5deg] rounded-[2.3rem] border border-white/10 bg-white/[0.055]" />
              <div className="absolute inset-0 rounded-[2.6rem] border border-white/15 bg-white/[0.07] p-3 shadow-[0_32px_90px_rgba(0,0,0,.48)] backdrop-blur-lg sm:p-5">
                <div className="flex items-center justify-between px-3 py-2 text-[0.56rem] font-black uppercase tracking-[0.22em] text-white/45"><span>Decline ←</span><span>Quest {swipeIndex + 1} / {swipeQuests.length}</span><span>→ Accept</span></div>
                <div className="relative mt-2 h-[27rem] overflow-hidden rounded-[2rem]">
                  <AnimatePresence mode="popLayout" custom={swipeDirection}>
                    <motion.article
                      key={swipeQuests[swipeIndex].title}
                      initial={{ opacity: 0, scale: 0.92, x: swipeDirection * -80, rotate: swipeDirection * -4 }}
                      animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.94, x: swipeDirection * 520, rotate: swipeDirection * 13 }}
                      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                      drag={prefersReducedMotion ? false : "x"}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.72}
                      onDragEnd={(_, info) => {
                        if (Math.abs(info.offset.x) > 80) advanceSwipe(info.offset.x > 0 ? 1 : -1);
                      }}
                      className={`${swipeQuests[swipeIndex].className} absolute inset-0 cursor-grab touch-pan-y overflow-hidden rounded-[2rem] bg-cover bg-center will-change-transform active:cursor-grabbing`}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,8,.08),rgba(8,9,8,.9))]" />
                      <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
                        <div className="flex items-center justify-between"><span className="rounded-full border border-white/25 bg-black/20 px-3 py-2 text-[0.56rem] font-black uppercase tracking-[0.2em] backdrop-blur-xl">{swipeQuests[swipeIndex].kicker}</span><span className="grid size-11 place-items-center rounded-full bg-[#d8ff32] text-black"><Zap size={18} /></span></div>
                        <div>
                          <h3 className="max-w-lg font-display text-4xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-6xl">{swipeQuests[swipeIndex].title}</h3>
                          <p className="mt-4 max-w-md text-sm leading-6 text-white/65">{swipeQuests[swipeIndex].detail}</p>
                          <div className="mt-6 flex gap-2"><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur-xl">{swipeQuests[swipeIndex].distance}</span><span className="rounded-full bg-[#d8ff32] px-4 py-2 text-xs font-black text-black">{swipeQuests[swipeIndex].reward}</span></div>
                        </div>
                      </div>
                    </motion.article>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="how-it-plays" ref={modesRef} className="relative bg-[#f1ede3] px-5 py-28 text-[#131411] sm:px-9 lg:px-14 lg:py-40">
        <div className="mx-auto max-w-[1428px]">
          <div className="flex flex-col justify-between gap-8 border-b border-black/15 pb-10 lg:flex-row lg:items-end">
            <div><p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-black/45">Pick your mode</p><h2 className="mt-5 max-w-4xl font-display text-[clamp(3.8rem,7.5vw,8.2rem)] font-black uppercase leading-[0.78] tracking-[-0.08em]">Three ways<br />to play.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-black/55 sm:text-base">No streaks to protect. No endless feed. Just a reason to get up, go out and do something worth remembering.</p>
          </div>

          <div className="mt-10 hidden gap-4 lg:grid lg:grid-cols-3">
            {questModes.map(({ number, title, label, description, icon: Icon, className }, index) => (
              <motion.article
                key={label}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 70, rotate: index === 1 ? 0 : index === 0 ? -2 : 2 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, amount: 0.22 }}
                transition={{ duration: 0.75, delay: index * 0.11, ease: [0.16, 1, 0.3, 1] }}
                className={`${className} group relative flex min-h-[34rem] overflow-hidden rounded-[1.7rem] border border-black/15 bg-cover bg-center p-6 text-white sm:p-8`}
              >
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,11,9,.05),rgba(10,11,9,.84))] transition duration-700 group-hover:bg-[linear-gradient(180deg,rgba(10,11,9,0),rgba(10,11,9,.72))]" />
                <div className="relative flex w-full flex-col">
                  <div className="flex items-center justify-between"><span className="text-[0.62rem] font-black uppercase tracking-[0.25em]">Mode {number}</span><span className="grid size-11 place-items-center rounded-full border border-white/30 bg-black/10 backdrop-blur"><Icon size={18} /></span></div>
                  <div className="mt-auto"><span className="inline-flex rounded-full bg-[#d8ff32] px-3 py-1 text-[0.58rem] font-black uppercase tracking-[0.2em] text-black">{label}</span><h3 className="mt-4 font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.055em]">{title}</h3><p className="mt-4 max-w-xs text-sm leading-6 text-white/65">{description}</p></div>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="relative mt-10 h-[35rem] lg:hidden">
            <div aria-hidden="true" className="absolute inset-x-5 top-4 h-[31rem] rotate-[-3deg] rounded-[1.7rem] bg-black/10" />
            <div aria-hidden="true" className="absolute inset-x-5 top-4 h-[31rem] rotate-[3deg] rounded-[1.7rem] bg-black/10" />
            <AnimatePresence mode="popLayout">
              {(() => {
                const mode = questModes[activeMode];
                const Icon = mode.icon;
                return (
                  <motion.article
                    key={mode.label}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: 70, scale: 0.94, rotate: 3 }}
                    animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -70, scale: 0.94, rotate: -3 }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    className={`${mode.className} absolute inset-x-0 top-0 flex h-[32rem] overflow-hidden rounded-[1.7rem] border border-black/15 bg-cover bg-center p-6 text-white`}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,11,9,.05),rgba(10,11,9,.84))]" />
                    <div className="relative flex w-full flex-col">
                      <div className="flex items-center justify-between"><span className="text-[0.62rem] font-black uppercase tracking-[0.25em]">Mode {mode.number}</span><span className="grid size-11 place-items-center rounded-full border border-white/30 bg-black/10 backdrop-blur"><Icon size={18} /></span></div>
                      <div className="mt-auto"><span className="inline-flex rounded-full bg-[#d8ff32] px-3 py-1 text-[0.58rem] font-black uppercase tracking-[0.2em] text-black">{mode.label}</span><h3 className="mt-4 font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.055em]">{mode.title}</h3><p className="mt-4 max-w-xs text-sm leading-6 text-white/65">{mode.description}</p></div>
                    </div>
                  </motion.article>
                );
              })()}
            </AnimatePresence>
            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Quest mode carousel">
              {questModes.map((mode, index) => (
                <button key={mode.label} type="button" onClick={() => setActiveMode(index)} aria-label={`Show ${mode.label} mode`} className={`h-2 rounded-full transition-all ${activeMode === index ? "w-8 bg-black" : "w-2 bg-black/25"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative isolate grid min-h-[100svh] min-h-[100dvh] w-full place-items-center overflow-hidden bg-[#10110e] px-5 py-16 text-center sm:py-24">
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d8ff32]/15" />
        <motion.div aria-hidden="true" animate={prefersReducedMotion ? undefined : { rotate: 360 }} transition={{ duration: 34, repeat: Infinity, ease: "linear" }} className="absolute left-1/2 top-1/2 size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#d8ff32]/25" />
        <div className="relative z-10 max-w-5xl">
          <Sparkles className="mx-auto text-[#d8ff32]" size={34} />
          <motion.h2 initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.8 }} className="mt-8 font-display text-[clamp(4rem,9vw,9rem)] font-black uppercase leading-[0.8] tracking-[-0.08em]">Your next story<br /><span className="text-[#d8ff32]">is out there.</span></motion.h2>
          <p className="mx-auto mt-8 max-w-lg text-base leading-7 text-white/55">We are tuning the last level before SideQuest opens to everyone.</p>
          <Link href="/coming-soon" className="group mx-auto mt-10 flex w-fit items-center gap-5 rounded-full bg-[#d8ff32] px-8 py-5 text-sm font-black uppercase tracking-[0.2em] text-black transition hover:scale-105">Open app <ArrowRight size={18} className="transition-transform group-hover:translate-x-2" /></Link>
        </div>
      </section>
    </main>
  );
}
