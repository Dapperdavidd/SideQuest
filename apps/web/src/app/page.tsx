import Link from "next/link";
import { ArrowRight, Banknote, MapPin, Play, Sparkles, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";

const benefits = [
  { icon: UsersRound, title: "Social challenges", body: "Make a memory with friends and communities." },
  { icon: Banknote, title: "Small, real rewards", body: "A few winners, transparent rules, verified payouts." },
  { icon: MapPin, title: "Things worth finding", body: "Discover your campus, city, and the places between." },
  { icon: Sparkles, title: "Everyday adventure", body: "Turn an ordinary afternoon into a story." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-dark p-3 text-white sm:p-5">
      <section className="relative isolate mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1440px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#111411]">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_70%_30%,rgba(199,255,0,0.14),transparent_28%),linear-gradient(135deg,#111411,#171c17_55%,#0d100e)]" />
        <div className="absolute -right-20 top-28 -z-10 h-[33rem] w-[33rem] rounded-full bg-accent/10 blur-3xl" />
        <header className="flex items-center justify-between px-6 py-6 lg:px-12">
          <Logo inverse />
          <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex" aria-label="Primary">
            <Link href="/discover" className="transition hover:text-white">Explore</Link>
            <a href="#why" className="transition hover:text-white">How it works</a>
            <a href="#why" className="transition hover:text-white">For businesses</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="hidden rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold sm:block">Log in</Link>
            <Link href="/discover" className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark transition hover:bg-[#d4ff3d]">Get started</Link>
          </div>
        </header>
        <div className="grid items-center gap-14 px-6 pb-12 pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:pb-16 lg:pt-20">
          <div className="max-w-2xl">
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/75"><Sparkles size={15} className="text-accent" /> Small challenges. Better stories.</div>
            <h1 className="font-display text-[clamp(3.2rem,7vw,6.9rem)] font-bold leading-[0.94] tracking-[-0.065em]">Life comes with <span className="text-accent">side quests.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/65 sm:text-lg">Find something unexpected to do, challenge your people, explore your city, and earn real rewards along the way.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/discover" className="flex items-center gap-3 rounded-full bg-accent px-6 py-3.5 font-bold text-dark transition hover:gap-4">Find a quest <ArrowRight size={18} /></Link>
              <button className="flex items-center gap-3 rounded-full border border-white/20 px-6 py-3.5 font-semibold text-white"><span className="grid h-7 w-7 place-items-center rounded-full bg-white text-dark"><Play size={13} fill="currentColor" /></span>See how it works</button>
            </div>
            <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-7">
              <div><dt className="font-display text-xl font-bold text-accent">10 max</dt><dd className="mt-1 text-xs text-white/50">entries per quest</dd></div>
              <div><dt className="font-display text-xl font-bold text-accent">3 max</dt><dd className="mt-1 text-xs text-white/50">winners</dd></div>
              <div><dt className="font-display text-xl font-bold text-accent">1 story</dt><dd className="mt-1 text-xs text-white/50">worth telling</dd></div>
            </dl>
          </div>
          <div className="relative mx-auto min-h-[31rem] w-full max-w-[39rem]">
            <div className="photo-sunset absolute inset-x-0 top-0 h-[30rem] rounded-[2rem] bg-cover bg-center shadow-2xl shadow-black/40" />
            <div className="absolute bottom-8 left-5 max-w-[17rem] rounded-[1.25rem] border border-white/15 bg-black/65 p-4 backdrop-blur-xl sm:left-[-1.75rem]">
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Explore quest</span>
              <h2 className="mt-2 font-display text-xl font-bold">Catch the city at golden hour</h2>
              <p className="mt-2 text-sm text-white/60">3 of 5 entries received · 1 winner</p>
            </div>
            <div className="absolute right-[-0.5rem] top-9 rotate-3 rounded-2xl bg-white p-4 text-dark shadow-xl sm:right-[-1.5rem]"><p className="text-xs font-semibold text-muted">New quest near you</p><p className="mt-1 font-display font-bold">$10 reward</p></div>
          </div>
        </div>
        <div id="why" className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-12 lg:pb-12">
          {benefits.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-[1.25rem] bg-[#f8f8f5] p-5 text-dark"><div className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft"><Icon size={19} /></div><h2 className="mt-6 font-display font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{body}</p></article>
          ))}
        </div>
      </section>
    </main>
  );
}
