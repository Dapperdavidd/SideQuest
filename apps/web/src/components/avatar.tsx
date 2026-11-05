type AvatarProps = {
  name: string;
  url?: string | null;
  size?: number;
  tone?: "lime" | "inv" | "coral" | "sunken";
  tilt?: number;
  ring?: boolean;
  className?: string;
};

const tones = {
  lime: "bg-lime text-on-lime",
  inv: "bg-inv text-on-inv",
  coral: "bg-coral text-[#111111]",
  sunken: "bg-sunken text-ink",
} as const;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SQ";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Round avatar with a slight tilt, matching the playful sticker language of the design. */
export function Avatar({ name, url, size = 42, tone = "lime", tilt = 0, ring = false, className = "" }: AvatarProps) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-extrabold ${tones[tone]} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.33)), transform: tilt ? `rotate(${tilt}deg)` : undefined, boxShadow: ring ? "0 0 0 3px var(--bg)" : undefined }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
