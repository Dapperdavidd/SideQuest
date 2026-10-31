import { Clock3, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";

type QuestCardProps = {
  href: string;
  imageClass: string;
  imageUrl?: string | null;
  title: string;
  creator: string;
  reward?: string;
  entries: string;
  deadline: string;
  location?: string | null;
  distanceKm?: number | null;
  questType?: "FRIENDS" | "BOUNTY" | "EXPLORE";
  participants?: number;
  creatorAvatarUrl?: string | null;
};

export function QuestCard({ href, imageClass, imageUrl, title, creator, reward, entries, deadline, location, distanceKm, questType = "EXPLORE", participants = 0, creatorAvatarUrl }: QuestCardProps) {
  const typeLabel = questType === "FRIENDS" ? "With friends" : questType === "BOUNTY" ? "Reward quest" : "Out & about";
  return (
    <Link href={href} className="group block overflow-hidden rounded-[1.35rem] border border-black/8 bg-white shadow-[0_12px_35px_rgba(25,24,18,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(25,24,18,0.12)]">
      <div className={`${imageClass} relative h-48 bg-cover bg-center p-3.5 text-white`} style={imageUrl ? { backgroundImage: `linear-gradient(rgba(23,25,23,.04),rgba(23,25,23,.58)),url(${JSON.stringify(imageUrl)})` } : undefined}>
        <div className="flex items-start justify-between gap-2"><span className="rounded-full bg-white/90 px-3 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-dark backdrop-blur">{typeLabel}</span>{reward ? <span className="rounded-full bg-accent px-3 py-1.5 text-[0.68rem] font-extrabold text-dark">{reward}</span> : null}</div>
        <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold backdrop-blur-md">{deadline}</span>
      </div>
      <div className="p-4.5">
        <h3 className="font-display text-[1.08rem] font-bold leading-snug tracking-[-0.02em] text-dark">{title}</h3>
        <div className="mt-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[#e7e1d6] text-[0.66rem] font-extrabold text-dark">{creatorAvatarUrl ? <img src={creatorAvatarUrl} alt="" className="h-full w-full object-cover" /> : creator.charAt(0).toUpperCase()}</span><p className="text-xs font-semibold text-muted">Hosted by {creator}</p></div>
        {location ? <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted"><MapPin size={13} aria-hidden="true" />{location}{distanceKm !== null && distanceKm !== undefined ? ` · ${distanceKm < 1 ? "<1" : distanceKm.toFixed(1)} km` : ""}</p> : null}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/7 pt-3 text-xs font-bold text-foreground">
          <span className="flex items-center gap-1.5"><UsersRound size={14} aria-hidden="true" /> {participants ? `${participants} joined` : "Be the first"}</span>
          <span className="flex items-center gap-1.5 text-muted"><Clock3 size={14} aria-hidden="true" /> {entries}</span>
        </div>
      </div>
    </Link>
  );
}
