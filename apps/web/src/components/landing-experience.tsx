"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Bell,
  Compass,
  Footprints,
  MapPin,
  Sparkles,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

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

const runnerColors = ["#d8ff32", "#ff7f50", "#f4f0e7"];

export function LandingExperience() {
  const heroRef = useRef<HTMLElement>(null);
  const dispatchRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
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
  const notificationX = useSpring(
    useTransform(dispatchProgress, [0.1, 0.48, 0.82], [220, 0, -60]),
    { stiffness: 90, damping: 24 },
  );
  const notificationRotate = useTransform(dispatchProgress, [0.1, 0.5], [8, -2]);

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

            <motion.a
              href="#dispatch"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.75, type: "spring" }}
              className="group relative mb-4 hidden size-32 shrink-0 place-items-center rounded-full bg-[#d8ff32] text-black transition hover:scale-105 lg:grid"
            >
              <span className="text-center text-xs font-black uppercase tracking-[0.2em]">Enter</span>
              <ArrowDown className="absolute mt-9 transition-transform group-hover:translate-y-2" size={18} />
            </motion.a>
          </div>

          <div className="mx-auto mt-8 flex w-full max-w-[1428px] items-end justify-between gap-6 border-t border-white/20 pt-5">
            <p className="max-w-sm text-sm leading-6 text-white/66 sm:text-base">Turn the plans you nearly skipped into the stories you keep telling.</p>
            <a href="#dispatch" className="flex items-center gap-3 rounded-full bg-[#d8ff32] px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-black lg:hidden">Enter <ArrowDown size={15} /></a>
            <div className="hidden items-center gap-3 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/50 sm:flex"><span>Scroll to play</span><ArrowDown size={14} className="landing-bounce" /></div>
          </div>
        </motion.div>

        <motion.div
          aria-hidden="true"
          initial={prefersReducedMotion ? false : { opacity: 0, x: 60, rotate: 5 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0], x: [60, 0, 0, -20], y: [10, 0, 0, -18], rotate: [5, 0, 0, -2] }}
          transition={{ duration: 5.4, delay: 1.35, repeat: prefersReducedMotion ? 0 : Infinity, repeatDelay: 2.4, times: [0, 0.13, 0.78, 1] }}
          className="absolute right-[6vw] top-[18vh] z-20 hidden w-[21rem] rounded-[1.4rem] border border-white/20 bg-black/55 p-4 shadow-2xl backdrop-blur-2xl md:block"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#d8ff32] text-black"><Zap size={19} fill="currentColor" /></span>
            <div className="min-w-0 flex-1"><p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[#d8ff32]">New side quest</p><p className="mt-1 text-sm font-semibold text-white">Catch the last light.</p></div>
            <span className="text-[0.62rem] text-white/45">now</span>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[0.7rem] text-white/60"><MapPin size={13} /> Rooftop lookout · 0.8 km</div>
        </motion.div>

        <div aria-hidden="true" className="absolute bottom-[17%] left-0 z-20 h-14 w-full overflow-hidden opacity-80">
          {runnerColors.map((color, index) => (
            <motion.div
              key={color}
              className="absolute left-0 top-3 grid size-9 place-items-center rounded-full border border-white/20 bg-black/60 shadow-xl backdrop-blur"
              animate={prefersReducedMotion ? undefined : { x: ["-10vw", "110vw"], y: [4, -8, 2, -5, 4] }}
              transition={{ duration: 8.2 + index * 1.4, delay: 2.1 + index * 1.2, repeat: Infinity, ease: "linear" }}
              style={{ color }}
            >
              <Footprints size={15} />
            </motion.div>
          ))}
        </div>
      </section>

      <section id="dispatch" ref={dispatchRef} className="relative min-h-[165vh] bg-[#d8ff32] text-[#10110e]">
        <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-5 py-24 sm:px-9 lg:px-14">
          <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-35" />
          <div className="relative mx-auto grid w-full max-w-[1428px] items-center gap-16 lg:grid-cols-[0.86fr_1.14fr]">
            <div>
              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} className="text-[0.65rem] font-black uppercase tracking-[0.32em]">Quest dispatch / 8:41 PM</motion.p>
              <motion.h2 initial={{ opacity: 0, y: 45 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7 }} className="mt-7 max-w-[42rem] font-display text-[clamp(4rem,7vw,7.7rem)] font-black uppercase leading-[0.82] tracking-[-0.075em]">
                A quiet day.<br />Then—<span className="italic">ping.</span>
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.25 }} className="mt-8 max-w-md text-base font-medium leading-7 text-black/65">A SideQuest arrives at exactly the wrong time. Which is usually the right time to say yes.</motion.p>
            </div>

            <motion.div className="relative mx-auto w-full max-w-[41rem]" style={prefersReducedMotion ? undefined : { x: notificationX, rotate: notificationRotate }}>
              <div aria-hidden="true" className="absolute -inset-12 rounded-full border border-black/10" />
              <div aria-hidden="true" className="absolute -inset-24 rounded-full border border-black/[0.06]" />
              <div className="relative overflow-hidden rounded-[2rem] border-2 border-black bg-[#11120f] p-5 text-white shadow-[18px_22px_0_#11120f] sm:p-7">
                <div className="flex items-center justify-between border-b border-white/15 pb-5"><span className="font-display text-xl font-black tracking-[-0.06em]">sidequest<span className="text-[#d8ff32]">.</span></span><span className="text-[0.6rem] uppercase tracking-[0.22em] text-white/45">just now</span></div>
                <div className="flex gap-4 py-7 sm:gap-6">
                  <motion.span animate={prefersReducedMotion ? undefined : { scale: [1, 1.14, 1] }} transition={{ duration: 1.3, repeat: Infinity }} className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#d8ff32] text-black sm:size-20"><Bell size={30} /></motion.span>
                  <div><p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#d8ff32]">New quest nearby</p><h3 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-4xl">The city looks different after midnight.</h3><p className="mt-3 text-sm leading-6 text-white/55">Find the three glowing checkpoints before the clock runs out.</p></div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-white/15 pt-5 text-center"><div><b className="block text-lg">2.4 km</b><span className="text-[0.55rem] uppercase tracking-widest text-white/40">distance</span></div><div><b className="block text-lg">45 min</b><span className="text-[0.55rem] uppercase tracking-widest text-white/40">time left</span></div><div><b className="block text-lg">10 NIM</b><span className="text-[0.55rem] uppercase tracking-widest text-white/40">reward</span></div></div>
                <Link href="/coming-soon" className="group mt-6 flex w-full items-center justify-between rounded-full bg-[#d8ff32] px-6 py-4 text-sm font-black uppercase tracking-[0.15em] text-black"><span>Accept quest</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-2" /></Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="how-it-plays" className="relative bg-[#f1ede3] px-5 py-28 text-[#131411] sm:px-9 lg:px-14 lg:py-40">
        <div className="mx-auto max-w-[1428px]">
          <div className="flex flex-col justify-between gap-8 border-b border-black/15 pb-10 lg:flex-row lg:items-end">
            <div><p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-black/45">Pick your mode</p><h2 className="mt-5 max-w-4xl font-display text-[clamp(3.8rem,7.5vw,8.2rem)] font-black uppercase leading-[0.78] tracking-[-0.08em]">Three ways<br />to play.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-black/55 sm:text-base">No streaks to protect. No endless feed. Just a reason to get up, go out and do something worth remembering.</p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
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
        </div>
      </section>

      <section className="relative grid min-h-[95svh] place-items-center overflow-hidden bg-[#10110e] px-5 py-24 text-center">
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
