import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { getMyQuests } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { FundingPanel } from "../../../create/funding-panel";

type FundingPageProps = {
  params: Promise<{ id: string }>;
};

export default function FundingPage(props: FundingPageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><FundingExperience {...props} /></Suspense>;
}

async function FundingExperience({ params }: FundingPageProps) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?next=${encodeURIComponent(`/quests/${id}/fund`)}`);

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect(`/auth?next=${encodeURIComponent(`/quests/${id}/fund`)}`);

  const quests = await getMyQuests(session.access_token);
  const quest = quests.find((candidate) => candidate.id === id && candidate.relationship === "CREATOR");
  if (!quest) redirect("/quests");
  if (quest.status !== "AWAITING_FUNDING") redirect(`/quests/${id}`);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <Link href="/quests" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold"><ArrowLeft size={16} /> My quests</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-7 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_280px] sm:px-8 sm:py-12">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Reward escrow</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Fund {quest.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Your quest is saved but remains private until its full reward pool is confirmed on Nimiq Testnet.</p>
          <FundingPanel questId={id} />
        </section>
        <aside className="order-first lg:order-last">
          <div className="rounded-[1.5rem] bg-dark p-6 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-dark"><ShieldCheck size={21} /></span>
            <h2 className="mt-5 font-display text-xl font-bold">Verified before opening</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">SideQuest verifies the recipient, exact luna amount, payment reference, and confirmations independently before publishing the quest.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
