import Link from "next/link";
import { ChevronRight, Vote } from "lucide-react";
import { challengePhase, hoursLeft, type FriendsChallenge } from "@/lib/api/friends";
import { questCover } from "@/lib/api/quests";

export function ChallengeRow({ challenge }: { challenge: FriendsChallenge }) {
  const phase = challengePhase(challenge);
  const label = phase === "VOTING" ? <>Voting open · <span className="font-mono">{hoursLeft(challenge.votes_close_at)} h</span> left</> : phase === "OPEN" ? <>Submit in <span className="font-mono">{hoursLeft(challenge.deadline)} h</span></> : "Results coming";
  const href = phase === "VOTING" ? `/quests/${challenge.id}/vote` : `/quests/${challenge.id}`;
  return (
    <article className="sq-card flex flex-wrap items-center gap-4 p-5">
      <img src={questCover({ id: challenge.id, cover_media_url: challenge.cover_media_url, quest_type: "FRIENDS" })} alt="" className="h-20 w-20 flex-none -rotate-3 rounded-[16px] border-[3px] border-surface object-cover shadow-[var(--shadow-card)]" />
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
        <span className={`sq-pill self-start ${phase === "VOTING" ? "bg-coral text-[#111111]" : "bg-lime-tint text-ink"}`}>{label}</span>
        <Link href={`/quests/${challenge.id}`} className="font-display text-2xl font-black uppercase leading-none tracking-[-0.03em]">{challenge.title}</Link>
        <span className="text-sm text-ink-2">By {challenge.creator_display_name} · {challenge.entries_received} in{challenge.friendly_stake ? ` · stake: ${challenge.friendly_stake}` : ""}</span>
      </div>
      <Link href={href} className={`sq-btn ${phase === "VOTING" && !challenge.viewer_voted ? "sq-btn-lime" : "sq-btn-ghost"} !min-h-12`}>
        {phase === "VOTING" ? (challenge.viewer_voted ? "See ballot" : <><Vote size={16} aria-hidden="true" />Vote</>) : challenge.viewer_entered ? "View" : <>Play<ChevronRight size={16} aria-hidden="true" /></>}
      </Link>
    </article>
  );
}
