import Link from "next/link";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="SideQuest home"
      className={`font-display text-[1.18rem] font-extrabold tracking-[-0.06em] ${inverse ? "text-white" : "text-foreground"}`}
    >
      sidequest<span className="text-accent">.</span>
    </Link>
  );
}
