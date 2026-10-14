import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { getQuest } from "@/lib/api/quests";
import { SubmissionForm } from "./submission-form";

type SubmitPageProps = {
  params: Promise<{ id: string }>;
};

export default function SubmitPage(props: SubmitPageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><SubmitExperience {...props} /></Suspense>;
}

async function SubmitExperience({ params }: SubmitPageProps) {
  const { id } = await params;
  const quest = await getQuest(id);
  if (!quest) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8"><Logo /><Link href={`/quests/${quest.id}`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold"><ArrowLeft size={16} /> Quest</Link></header>
      <div className="mx-auto grid max-w-5xl gap-7 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 lg:py-10"><SubmissionForm quest={quest} /><aside className="order-first lg:order-last"><div className="rounded-[1.5rem] bg-dark p-6 text-white"><span className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Submitting to</span><h2 className="mt-3 font-display text-2xl font-bold">{quest.title}</h2><p className="mt-3 text-sm leading-6 text-white/55">by {quest.creator_display_name}</p><dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm"><div className="flex justify-between gap-3"><dt className="text-white/45">Proof types</dt><dd className="text-right font-bold">{quest.proof_requirements.length}</dd></div><div className="flex justify-between gap-3"><dt className="text-white/45">Entries used</dt><dd className="font-bold">{quest.entries_received}/{quest.max_entries}</dd></div><div className="flex justify-between gap-3"><dt className="text-white/45">Selection</dt><dd className="text-right font-bold">{quest.winner_selection_method === "FIRST_VALID" ? "First valid" : "Best submission"}</dd></div></dl></div></aside></div>
    </main>
  );
}
