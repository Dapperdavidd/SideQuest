import Link from "next/link";
import { SpotsMeter } from "@/components/spots-meter";
import { isHunt, questCover, rewardAmount, type Quest } from "@/lib/api/quests";

type QuestCardProps = {
  quest: Quest;
  tall?: boolean;
  tilt?: number;
};

const categoryLabel = (quest: Quest) => {
  if (quest.quest_type === "FRIENDS") return "Friends";
  if (isHunt(quest)) return `Hunt · ${quest.checkpoint_count} stops`;
  return "Bounty";
};

export function questMetaLine(quest: Quest) {
  const parts = [
    quest.organization_display_name ?? quest.creator_display_name,
    quest.distance_km !== null && quest.distance_km !== undefined ? `${quest.distance_km < 1 ? "<1" : quest.distance_km.toFixed(1)} km` : quest.location_name,
    quest.winner_selection_method === "BEST_SUBMISSION" ? "Best submission" : `First ${quest.winner_count} win`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** The ticket-style quest card: poster on top, a torn perforation, reward and spots below. */
export function QuestCard({ quest, tall = false, tilt = 0 }: QuestCardProps) {
  const reward = rewardAmount(quest);
  const used = Math.min(quest.entries_received, quest.max_entries);
  const left = Math.max(0, quest.max_entries - used);
  return (
    <Link
      href={`/quests/${quest.id}`}
      className="group relative mt-3 block rounded-[26px] border border-line bg-surface text-ink shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1"
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <span className={`relative block overflow-hidden rounded-t-[25px] ${tall ? "h-[400px]" : "h-[260px]"}`}>
        <img src={questCover(quest)} alt={`Cover art for ${quest.title}`} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(17,17,17,0)_50%,rgba(17,17,17,0.85)_100%)]" />
        <span className="absolute inset-x-5 bottom-[18px] flex flex-col gap-2 text-white">
          <span className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-white/90">{questMetaLine(quest)}</span>
          <span className={`font-display font-black uppercase leading-[0.86] tracking-[-0.05em] ${tall ? "text-[34px]" : "text-[28px]"}`}>{quest.title}</span>
        </span>
      </span>
      <span className="sq-sticker sq-sticker-lime absolute -top-3 left-5 -rotate-6">{categoryLabel(quest)}</span>
      <span className="sq-ticket-tear flex items-end justify-between px-[22px] pb-4 pt-3.5">
        <span className="flex flex-col gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink-3">Reward</span>
          <span className="font-display text-[26px] font-black uppercase leading-[0.86] tracking-[-0.04em]">{reward ?? "Glory"}</span>
        </span>
        <span className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-ink-3">{left}/{quest.max_entries} spots left</span>
          <SpotsMeter total={quest.max_entries} used={used} />
        </span>
      </span>
    </Link>
  );
}
