import { Clock3, Trophy } from "lucide-react";

type QuestCardProps = {
  imageClass: string;
  title: string;
  creator: string;
  reward?: string;
  entries: string;
  deadline: string;
};

export function QuestCard({ imageClass, title, creator, reward, entries, deadline }: QuestCardProps) {
  return (
    <article className="group overflow-hidden rounded-[1.15rem] border border-line bg-surface shadow-[0_14px_42px_rgba(24,27,24,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_56px_rgba(24,27,24,0.12)]">
      <div className={`${imageClass} h-44 bg-cover bg-center p-4 text-white`}>
        <div className="flex h-full flex-col justify-end">
          {reward ? <span className="mb-2 w-fit rounded-full bg-accent px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-dark">{reward} reward</span> : null}
          <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-muted">by {creator}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-foreground">
          <span className="flex items-center gap-1.5"><Trophy size={14} aria-hidden="true" /> {entries}</span>
          <span className="flex items-center gap-1.5 text-muted"><Clock3 size={14} aria-hidden="true" /> {deadline}</span>
        </div>
      </div>
    </article>
  );
}
