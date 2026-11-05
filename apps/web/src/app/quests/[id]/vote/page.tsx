import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { getBallot, hoursLeft } from "@/lib/api/friends";
import { createClient } from "@/lib/supabase/server";
import { VoteForm } from "./vote-form";

export const metadata = { title: "Vote" };

export default function VotePage(props: PageProps<"/quests/[id]/vote">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><VoteContent {...props} /></Suspense>;
}

async function VoteContent({ params }: PageProps<"/quests/[id]/vote">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect(`/auth?next=/quests/${id}/vote`);
  const ballot = await getBallot(id, session.access_token);
  if (!ballot) notFound();
  const closes = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(ballot.votes_close_at));
  const ranked = ballot.phase === "CLOSED" ? [...ballot.candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) : ballot.candidates;

  return (
    <main className="min-h-screen bg-bg pb-40 text-ink">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pt-8">
        <div className="flex items-center gap-3">
          <Link href={`/quests/${ballot.quest_id}`} aria-label="Back to the challenge" className="grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface"><ArrowLeft size={20} aria-hidden="true" /></Link>
          <span className="sq-sticker sq-sticker-coral -rotate-3">{ballot.group_name ? `${ballot.group_name} · room vote` : "Room vote"}</span>
          <span className="ml-auto flex flex-col items-end gap-0.5">
            <span className="font-display text-[30px] font-black leading-[0.8] tracking-[-0.05em]">{ballot.phase === "VOTING" ? `${hoursLeft(ballot.votes_close_at)}H` : ballot.phase === "CLOSED" ? "DONE" : `${hoursLeft(ballot.deadline)}H`}</span>
            <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-ink-3">{ballot.phase === "VOTING" ? "LEFT TO VOTE" : ballot.phase === "CLOSED" ? "VOTING CLOSED" : "UNTIL VOTING"}</span>
          </span>
        </div>
        <h1 className="sq-display text-[clamp(36px,6vw,56px)]">{ballot.title}</h1>
        <ul aria-label="Voting rules" className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 border-y-2 border-inv px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-2 sm:grid-cols-4">
          <li><span className="text-ink">R1</span> 1 vote each</li><li><span className="text-ink">R2</span> Not for yourself</li><li><span className="text-ink">R3</span> Closes {closes}</li><li><span className="text-ink">R4</span> Ties share the win</li>
        </ul>
        {ballot.phase === "SUBMITTING" ? <p className="rounded-2xl bg-lime-tint p-4 text-sm">Voting opens when submissions close. Come back after the deadline.</p> : null}
        {ballot.phase === "CLOSED" ? (
          <ol className="flex flex-col gap-2.5">
            {ranked.map((candidate, index) => (
              <li key={candidate.entry_id} className="flex items-center gap-3 rounded-[20px] border border-line p-3">
                <span className={`grid h-9 w-9 place-items-center rounded-full font-display font-black ${index === 0 && candidate.votes ? "bg-lime text-on-lime" : "bg-sunken"}`}>{index + 1}</span>
                <Avatar name={candidate.participant_display_name} url={candidate.participant_avatar_url} size={36} tone="sunken" />
                <span className="flex-1 font-display text-lg font-black uppercase tracking-[-0.03em]">{candidate.participant_display_name}</span>
                <span className="font-mono text-sm font-bold">{candidate.votes ?? 0} vote{candidate.votes === 1 ? "" : "s"}</span>
              </li>
            ))}
            {!ranked.length ? <li className="text-sm text-ink-2">No entries came in, so this one ended with no contest.</li> : null}
          </ol>
        ) : (
          <VoteForm questId={ballot.quest_id} candidates={ballot.candidates} viewerVote={ballot.viewer_vote} canVote={ballot.viewer_can_vote} viewerId={session.user.id} />
        )}
        {ballot.phase !== "CLOSED" ? <span className="flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.06em] text-ink-3"><Lock size={12} aria-hidden="true" />RESULTS STAY HIDDEN UNTIL VOTING CLOSES</span> : null}
      </div>
    </main>
  );
}
