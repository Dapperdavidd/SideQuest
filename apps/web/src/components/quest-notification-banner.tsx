import type { LucideIcon } from "lucide-react";

type QuestNotificationBannerProps = {
  eyebrow: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  accent?: string;
  time?: string;
  className?: string;
};

export function QuestNotificationBanner({
  eyebrow,
  title,
  detail,
  icon: Icon,
  accent = "#d8ff32",
  time = "now",
  className = "",
}: QuestNotificationBannerProps) {
  return (
    <div
      className={`w-[min(21rem,calc(100vw-2rem))] rounded-[1.35rem] border border-white/20 bg-black/60 p-4 text-white shadow-2xl backdrop-blur-2xl ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-black" style={{ backgroundColor: accent }}>
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.56rem] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>{eyebrow}</p>
          <p className="mt-1 truncate text-sm font-semibold">{title}</p>
        </div>
        <span className="text-[0.6rem] text-white/45">{time}</span>
      </div>
      <p className="mt-3 border-t border-white/10 pt-3 text-[0.7rem] text-white/60">{detail}</p>
    </div>
  );
}
