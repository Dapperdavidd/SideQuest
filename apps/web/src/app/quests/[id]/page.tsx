import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Trophy, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { formatDeadline, formatReward, getQuest, questImageClass } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { JoinButton } from "./join-button";

type QuestPageProps = {
  params: Promise<{ id: string }>;
};

export default function QuestPage(props: QuestPageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}>
      <QuestExperience {...props} />
    </Suspense>
  );
}

async function QuestExperience({ params }: QuestPageProps) {
  const { id } = await params;
  const questPromise = getQuest(id);
  const viewerPromise = getViewer();
  const [quest, viewer] = await Promise.all([questPromise, viewerPromise]);
  if (!quest) notFound();

  const remainingEntries = Math.max(0, quest.max_entries - quest.entries_received);
  const isOpen = quest.status === "OPEN";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8">
        <Logo />
        <Link href="/discover" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold"><ArrowLeft size={16} /> Discover</Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_350px] lg:px-8 lg:py-10">
        <article>
          <div className={`${questImageClass(quest.quest_type)} min-h-[320px] rounded-[1.5rem] bg-cover bg-center p-6 text-white sm:min-h-[420px] sm:p-9`}>
            <div className="flex min-h-[272px] max-w-2xl flex-col justify-end sm:min-h-[348px]">
              <span className="w-fit rounded-full bg-[#9167ff] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider">{quest.quest_type}</span>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">{quest.title}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">by {quest.creator_display_name} · @{quest.creator_username}</p>
            </div>
          </div>

          <section className="mt-6 rounded-[1.5rem] border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">About this quest</h2>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-muted">{quest.description}</p>

            <h2 className="mt-8 font-display text-xl font-bold">What counts as proof</h2>
            <div className="mt-3 flex flex-wrap gap-2">{quest.proof_requirements.map((proof) => <span key={proof} className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-xs font-bold"><CheckCircle2 size={15} /> {proof.replaceAll("_", " ").toLowerCase()}</span>)}</div>

            {quest.judging_criteria ? <div className="mt-8 rounded-xl bg-background p-5"><h3 className="font-bold">Published judging criteria</h3><p className="mt-2 text-sm leading-6 text-muted">{quest.judging_criteria}</p></div> : null}
          </section>
        </article>

        <aside>
          <div className="sticky top-8 rounded-[1.5rem] border border-line bg-white p-6 shadow-[0_20px_60px_rgba(23,25,23,0.08)]">
            <div className="flex items-center justify-between"><span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase">{quest.status.replaceAll("_", " ")}</span><span className="text-sm font-bold">{formatReward(quest)}</span></div>
            <dl className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-background p-3"><dt className="font-display text-xl font-bold">{remainingEntries}</dt><dd className="mt-1 text-[0.65rem] text-muted">slots left</dd></div><div className="rounded-xl bg-background p-3"><dt className="font-display text-xl font-bold">{quest.winner_count}</dt><dd className="mt-1 text-[0.65rem] text-muted">winner{quest.winner_count === 1 ? "" : "s"}</dd></div><div className="rounded-xl bg-background p-3"><dt className="font-display text-xl font-bold">{quest.participants_joined}</dt><dd className="mt-1 text-[0.65rem] text-muted">joined</dd></div></dl>
            <div className="mt-6 space-y-4 border-y border-line py-5 text-sm"><div className="flex items-center gap-3"><CalendarDays size={18} className="text-muted" /><span><strong>{formatDeadline(quest.deadline)}</strong><span className="block text-xs text-muted">{new Date(quest.deadline).toLocaleString()}</span></span></div><div className="flex items-center gap-3"><UsersRound size={18} className="text-muted" /><span>{quest.is_group_challenge ? `Groups of ${quest.required_group_size}` : "Individual entries"}</span></div><div className="flex items-center gap-3"><Trophy size={18} className="text-muted" /><span>{quest.winner_selection_method === "FIRST_VALID" ? "Earliest valid entries win" : "Best valid submissions win"}</span></div></div>
            <div className="mt-6">{viewer?.id === quest.creator_id ? <Link href={`/quests/${quest.id}/review`} className="block w-full rounded-xl bg-accent px-6 py-4 text-center font-bold text-dark">Review submissions</Link> : <JoinButton questId={quest.id} isCreator={false} isOpen={isOpen} />}</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
