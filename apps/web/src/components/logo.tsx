import Link from "next/link";

type LogoProps = {
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string;
};

const sizes = { sm: "text-[1.25rem]", md: "text-[1.625rem]", lg: "text-[1.875rem]" } as const;

/** The SideQuest wordmark: heavy lowercase with a lime dot. */
export function Logo({ inverse = false, size = "md", href = "/" }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="SideQuest home"
      className={`inline-flex items-end gap-1 font-display font-black leading-[0.9] tracking-[-0.06em] ${sizes[size]} ${inverse ? "text-white" : "text-ink"}`}
    >
      sidequest
      <span
        aria-hidden="true"
        className="mb-[0.12em] inline-block h-[0.32em] w-[0.32em] rounded-full bg-lime"
        style={{ boxShadow: `0 0 0 1.5px ${inverse ? "#ffffff" : "var(--text)"}` }}
      />
    </Link>
  );
}
