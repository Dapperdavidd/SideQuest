type SpotsMeterProps = {
  total: number;
  used: number;
  size?: "sm" | "md" | "lg";
  numbered?: boolean;
};

const dims = { sm: "h-5 w-3.5 rounded", md: "h-6 w-4 rounded-[5px]", lg: "h-7 w-5 rounded-[5px]" } as const;

/** One bar per official entry slot: solid bars are taken, dashed bars are still open. */
export function SpotsMeter({ total, used, size = "sm", numbered = false }: SpotsMeterProps) {
  const slots = Math.max(1, Math.min(total, 10));
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: slots }, (_, index) => {
        const taken = index < used;
        return (
          <span
            key={index}
            className={`${dims[size]} grid place-items-center font-mono text-[11px] font-bold ${taken ? "bg-inv text-on-inv" : "border-[1.5px] border-dashed border-ink-3 text-ink-2"}`}
          >
            {numbered ? index + 1 : null}
          </span>
        );
      })}
    </span>
  );
}
