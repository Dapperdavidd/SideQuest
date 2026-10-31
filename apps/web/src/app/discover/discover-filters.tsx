"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";

type QuestType = "FRIENDS" | "BOUNTY" | "EXPLORE";

const filters = [
  ["All", ""],
  ["Friends", "FRIENDS"],
  ["Bounties", "BOUNTY"],
  ["Explore", "EXPLORE"],
] as const;

type DiscoverFiltersProps = {
  activeType?: QuestType;
  search: string;
};

export function DiscoverFilters({ activeType, search }: DiscoverFiltersProps) {
  const router = useRouter();
  const [optimisticType, setOptimisticType] = useOptimistic(activeType ?? "");
  const [isPending, startTransition] = useTransition();

  function selectFilter(value: "" | QuestType) {
    if (value === optimisticType && !isPending) return;

    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (value) params.set("type", value);
    const destination = `/discover${params.size ? `?${params.toString()}` : ""}`;

    startTransition(() => {
      setOptimisticType(value);
      router.replace(destination, { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-2">
      {filters.map(([label, value]) => {
        const selected = optimisticType === value;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => selectFilter(value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selected ? "bg-dark text-white" : "border border-black/10 bg-white/55 text-muted hover:border-black/25 hover:text-dark"}`}
          >
            {label}
          </button>
        );
      })}
      <span className={`whitespace-nowrap text-xs text-muted transition-opacity ${isPending ? "opacity-100" : "opacity-0"}`} aria-live="polite">
        Updating…
      </span>
    </div>
  );
}
