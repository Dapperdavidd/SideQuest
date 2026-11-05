"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { CastVoteButton } from "@/components/friends-actions";
import type { VoteCandidate } from "@/lib/api/friends";

type VoteFormProps = { questId: string; candidates: VoteCandidate[]; viewerVote: string | null; canVote: boolean; viewerId: string };

export function VoteForm({ questId, candidates, viewerVote, canVote, viewerId }: VoteFormProps) {
  const [pick, setPick] = useState<string | null>(viewerVote);
  const picked = candidates.find((candidate) => candidate.entry_id === pick);
  return (
    <>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Pick the best entry</legend>
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 sm:grid-cols-3">
          {candidates.map((candidate, index) => {
            const own = candidate.participant_id === viewerId;
            const selected = pick === candidate.entry_id;
            const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(candidate.submitted_at));
            return (
              <label key={candidate.entry_id} className={`relative flex flex-col gap-1.5 ${own || !canVote ? "" : "cursor-pointer"}`}>
                <span className={`font-mono text-[9px] font-bold tracking-[0.06em] ${selected ? "text-ink" : "text-ink-3"}`}>FRAME {String(index + 1).padStart(2, "0")} · {candidate.participant_display_name.toUpperCase()} · {time}</span>
                <span className="relative block p-[7px]">
                  {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((corner) => <span key={corner} aria-hidden="true" className={`absolute h-3 w-3 ${own ? "border-ink-3" : "border-ink"} ${corner}`} />)}
                  <span className={`relative block h-[150px] overflow-hidden rounded-md bg-sunken ${selected ? "shadow-[0_0_0_2px_var(--inv),0_0_0_6px_var(--lime)]" : ""}`}>
                    {candidate.media_url?.startsWith("https://") ? <img src={candidate.media_url} alt={`${candidate.participant_display_name}'s entry`} className={`h-full w-full object-cover ${own ? "opacity-50" : ""}`} /> : <span className="grid h-full place-items-center p-3 text-center text-xs text-ink-2">{candidate.caption ?? "Entry submitted"}</span>}
                    {candidate.caption && candidate.media_url ? <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(rgba(17,17,17,0),rgba(17,17,17,0.85))] px-2 pb-[7px] pt-[18px] text-[11px] leading-tight text-white">{candidate.caption}</span> : null}
                  </span>
                  {selected ? <span aria-hidden="true" className="sq-sticker sq-sticker-lime absolute -right-2 -top-3 rotate-[9deg] border-2 border-inv">Your pick</span> : null}
                  {own ? <span aria-hidden="true" className="absolute -left-2.5 -right-2.5 top-[72px] flex h-7 -rotate-[20deg] items-center justify-center bg-inv font-mono text-[11px] font-bold tracking-[0.1em] text-on-inv">YOUR ENTRY</span> : null}
                </span>
                <span className={`flex items-center gap-[7px] ${own ? "text-ink-3" : ""}`}>
                  <Avatar name={candidate.participant_display_name} url={candidate.participant_avatar_url} size={24} tone={own ? "inv" : "sunken"} />
                  <span className="flex-1 truncate font-display text-base font-black uppercase tracking-[-0.03em]">{own ? "You" : candidate.participant_display_name}</span>
                  <input type="radio" name="vote" value={candidate.entry_id} checked={selected} disabled={own || !canVote} onChange={() => setPick(candidate.entry_id)} aria-label={own ? "Your own entry, voting disabled" : `Vote for ${candidate.participant_display_name}`} className="h-5 w-5 accent-[var(--inv)]" />
                </span>
              </label>
            );
          })}
        </div>
        {!candidates.length ? <p className="text-sm text-ink-2">No entries yet.</p> : null}
      </fieldset>
      {canVote ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg px-4 pb-6 pt-2.5">
          <div className="mx-auto max-w-[760px]"><CastVoteButton questId={questId} entryId={pick} label={picked ? `Cast vote for ${picked.participant_display_name}` : "Pick an entry"} /></div>
        </div>
      ) : viewerVote ? <p className="rounded-2xl bg-lime-tint p-4 text-center text-sm font-semibold">Vote cast. Results show when voting closes.</p> : null}
    </>
  );
}
