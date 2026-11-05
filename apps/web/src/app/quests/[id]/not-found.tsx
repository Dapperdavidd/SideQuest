import Link from "next/link";

export default function QuestNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-sunken px-5 text-center">
      <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-ink-2">Quest unavailable</p><h1 className="mt-3 font-display text-4xl font-black uppercase">This quest is not public.</h1><p className="mx-auto mt-3 max-w-md leading-7 text-ink-2">It may still be a draft, awaiting funding, or no longer available.</p><Link href="/discover" className="mt-6 inline-block rounded-full bg-lime px-6 py-3 font-bold text-ink">Back to discovery</Link></div>
    </main>
  );
}
