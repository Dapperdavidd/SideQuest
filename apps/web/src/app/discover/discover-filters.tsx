"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

export type DiscoverFilter = "all" | "near" | "ending" | "hunts" | "recognition";

const filters: { value: DiscoverFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "near", label: "Near you" },
  { value: "ending", label: "Ending soon" },
  { value: "hunts", label: "Hunts" },
  { value: "recognition", label: "Recognition only" },
];

export function DiscoverFilters({ active, search }: { active: DiscoverFilter; search: string }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function go(value: DiscoverFilter, coords?: { latitude: number; longitude: number }) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (value !== "all") params.set("filter", value);
    if (coords) {
      params.set("lat", coords.latitude.toFixed(3));
      params.set("lng", coords.longitude.toFixed(3));
    }
    startTransition(() => {
      setOptimistic(value);
      router.replace(`/discover${params.size ? `?${params}` : ""}`, { scroll: false });
    });
  }

  function select(value: DiscoverFilter) {
    setError(null);
    if (value !== "near") return go(value);
    if (!navigator.geolocation) return setError("Location is not available in this browser.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocating(false); go("near", coords); },
      () => { setLocating(false); setError("Allow location access to see bounties within 25 km."); },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {filters.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={optimistic === value} onClick={() => select(value)} className="sq-chip">
            {value === "near" && locating ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
            {label}
          </button>
        ))}
        <span aria-live="polite" className={`self-center whitespace-nowrap text-xs text-ink-3 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>Updating…</span>
      </div>
      {error ? <p role="alert" className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
