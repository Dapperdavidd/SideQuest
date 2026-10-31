import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, CheckCircle2, MapPin, Trophy, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { formatDeadline, formatReward, getQuest, getQuestCheckpoints, getQuestSaved, getQuestWinners, questImageClass } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { JoinButton } from "./join-button";
import { SaveQuestButton } from "./save-quest-button";
import { InvitationPanel } from "./invitation-panel";
import { ReportContentButton } from "@/components/report-content-button";
import { ShareQuestButton } from "./share-quest-button";
import { CheckpointPanel } from "./checkpoint-panel";

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
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [quest, viewer, winners, checkpoints] = await Promise.all([
    getQuest(id, session?.access_token),
    getViewer(),
    getQuestWinners(id),
    getQuestCheckpoints(id, session?.access_token),
  ]);
  if (!quest) notFound();
  const initiallySaved = session ? await getQuestSaved(id, session.access_token) : false;

  const remainingEntries = Math.max(0, quest.max_entries - quest.entries_received);
  const isOpen = quest.status === "OPEN";

  return (
    <AppShell active="discover" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl } : null}>
      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_350px] lg:px-8 lg:py-9">
        <article>
          <div className={`${questImageClass(quest.quest_type)} min-h-[320px] rounded-[1.5rem] bg-cover bg-center p-6 text-white sm:min-h-[420px] sm:p-9`} style={quest.cover_media_url ? { backgroundImage: `linear-gradient(rgba(23,25,23,.08),rgba(23,25,23,.82)),url(${JSON.stringify(quest.cover_media_url)})` } : undefined}>
            <div className="flex min-h-[272px] max-w-2xl flex-col justify-end sm:min-h-[348px]">
              <span className="w-fit rounded-full bg-[#9167ff] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider">{quest.quest_type}</span>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">{quest.title}</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">by {quest.organization_slug && quest.organization_display_name ? <><Link href={`/businesses/${quest.organization_slug}`} className="font-bold underline decoration-accent decoration-2 underline-offset-4">{quest.organization_display_name}</Link><span className="text-white/55"> · verified business</span></> : <Link href={`/users/${quest.creator_username}`} className="font-bold underline decoration-accent decoration-2 underline-offset-4">{quest.creator_display_name} · @{quest.creator_username}</Link>}</p>
            </div>
          </div>

          {quest.status === "FINALIZED" ? <section className="mt-6 rounded-[1.5rem] border border-dark bg-dark p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Final results</p><h2 className="mt-2 font-display text-2xl font-bold">Quest winners</h2>{winners.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{winners.map((winner) => <div key={winner.entry_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-accent font-display text-lg font-bold text-dark">{winner.winner_position}</span><div><strong className="block">{winner.participant_display_name}</strong><span className="text-sm text-white/45">@{winner.participant_username}</span></div></div>)}</div> : <p className="mt-4 text-sm text-white/55">No valid winner was available when this quest was finalized.</p>}</section> : null}

          <section className="mt-6 rounded-[1.5rem] border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">About this quest</h2>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-muted">{quest.description}</p>

            <h2 className="mt-8 font-display text-xl font-bold">What counts as proof</h2>
            <div className="mt-3 flex flex-wrap gap-2">{quest.proof_requirements.map((proof) => <span key={proof} className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-xs font-bold"><CheckCircle2 size={15} /> {proof.replaceAll("_", " ").toLowerCase()}</span>)}</div>

            {quest.judging_criteria ? <div className="mt-8 rounded-xl bg-background p-5"><h3 className="font-bold">Published judging criteria</h3><p className="mt-2 text-sm leading-6 text-muted">{quest.judging_criteria}</p></div> : null}
            {quest.group_instructions ? <div className="mt-5 rounded-xl bg-accent-soft p-5"><h3 className="font-bold">Group instructions</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{quest.group_instructions}</p></div> : null}
          </section>

          {quest.proof_requirements.includes("QR_CHECKPOINT") ? <CheckpointPanel questId={quest.id} initialCheckpoints={checkpoints} isCreator={viewer?.id === quest.creator_id} joined={quest.viewer_joined} isOpen={isOpen} /> : null}
        </article>

        <aside>
          <div className="sticky top-8 rounded-[1.5rem] border border-line bg-white p-6 shadow-[0_20px_60px_rgba(23,25,23,0.08)]">
            <div className="flex items-center justify-between"><span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase">{quest.status.replaceAll("_", " ")}</span><span className="text-sm font-bold">{formatReward(quest)}</span></div>
            <dl className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-background p-3"><dt className="font-display text-xl font-bold">{remainingEntries}</dt><dd className="mt-1 text-[0.65rem] text-muted">slots left</dd></div><div className="rounded-xl bg-background p-3"><dt className="font-display text-xl font-bold">{quest.winner_count}</dt><dd className="mt-1 text-[0.65rem] text-muted">winner{quest.winner_count === 1 ? "" : "s"}</dd></div><div className="rounded-xl bg-background p-3"><dt className="font-display text-xl font-bold">{quest.participants_joined}</dt><dd className="mt-1 text-[0.65rem] text-muted">joined</dd></div></dl>
            <div className="mt-6 space-y-4 border-y border-line py-5 text-sm"><div className="flex items-center gap-3"><CalendarDays size={18} className="text-muted" /><span><strong>{formatDeadline(quest.deadline)}</strong><span className="block text-xs text-muted">{new Date(quest.deadline).toLocaleString()}</span></span></div>{quest.location_name ? <div className="flex items-center gap-3"><MapPin size={18} className="text-muted" /><span><strong>{quest.location_name}</strong><span className="block text-xs text-muted">Location is supporting context, not automatic proof.</span></span></div> : null}<div className="flex items-center gap-3"><UsersRound size={18} className="text-muted" /><span>{quest.is_group_challenge ? `Groups of ${quest.required_group_size}` : "Individual entries"}</span></div><div className="flex items-center gap-3"><Trophy size={18} className="text-muted" /><span>{quest.winner_selection_method === "FIRST_VALID" ? "Earliest valid entries win" : "Best valid submissions win"}</span></div></div>
            <div className="mt-6">{viewer?.id === quest.creator_id ? <Link href={quest.status === "FINALIZED" && quest.reward_enabled ? `/quests/${quest.id}/settlement` : `/quests/${quest.id}/review`} className="block w-full rounded-xl bg-accent px-6 py-4 text-center font-bold text-dark">{quest.status === "FINALIZED" && quest.reward_enabled ? "Track payouts" : "Review submissions"}</Link> : <JoinButton questId={quest.id} isCreator={false} isOpen={isOpen} initialJoined={quest.viewer_joined} />}</div>
            {viewer?.id !== quest.creator_id && quest.visibility === "PUBLIC" ? <SaveQuestButton questId={quest.id} initialSaved={initiallySaved} /> : null}
            {quest.visibility === "PUBLIC" ? <ShareQuestButton questId={quest.id} title={quest.title} /> : null}
            {viewer?.id === quest.creator_id && quest.visibility !== "PUBLIC" && isOpen ? <InvitationPanel questId={quest.id} /> : null}
            {viewer?.id !== quest.creator_id ? <div className="mt-5 flex justify-center"><ReportContentButton subjectType="QUEST" targetId={quest.id} returnPath={`/quests/${quest.id}`} /></div> : null}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
