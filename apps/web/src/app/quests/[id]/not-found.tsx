import Link from "next/link";

export default function QuestNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
      <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-muted">Quest unavailable</p><h1 className="mt-3 font-display text-4xl font-bold">This quest is not public.</h1><p className="mx-auto mt-3 max-w-md leading-7 text-muted">It may still be a draft, awaiting funding, or no longer available.</p><Link href="/discover" className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-bold text-dark">Back to discovery</Link></div>
    </main>
  );
}
