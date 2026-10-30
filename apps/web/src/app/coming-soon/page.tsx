import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function ComingSoonPage() {
  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[#0c0d0b] px-5 py-16 text-[#f6f3e9]">
      <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-[0.08]" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d8ff32]/10 blur-[120px]" />
      <Link href="/" className="absolute left-5 top-6 flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] text-white/70 transition hover:border-white/40 hover:text-white sm:left-9 sm:top-8"><ArrowLeft size={15} /> Back</Link>
      <section className="relative z-10 max-w-4xl text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#d8ff32] text-black"><Sparkles size={22} /></span>
        <p className="mt-8 text-[0.62rem] font-black uppercase tracking-[0.35em] text-[#d8ff32]">Final level loading</p>
        <h1 className="mt-6 font-display text-[clamp(4rem,10vw,9.5rem)] font-black uppercase leading-[0.78] tracking-[-0.085em]">Coming<br />soon.</h1>
        <p className="mx-auto mt-8 max-w-lg text-base leading-7 text-white/55">SideQuest is almost ready to turn everyday plans into something worth chasing.</p>
        <div className="mx-auto mt-10 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/10"><div className="landing-loading-bar h-full rounded-full bg-[#d8ff32]" /></div>
      </section>
    </main>
  );
}
