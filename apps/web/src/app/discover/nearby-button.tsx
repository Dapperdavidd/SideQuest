"use client";

import { LocateFixed, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type NearbyButtonProps = {
  active: boolean;
  search: string;
};

export function NearbyButton({ active, search }: NearbyButtonProps) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clear() {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("type", "EXPLORE");
    router.push(`/discover?${params.toString()}`);
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        params.set("type", "EXPLORE");
        params.set("lat", coords.latitude.toFixed(3));
        params.set("lng", coords.longitude.toFixed(3));
        params.set("nearby", "1");
        router.push(`/discover?${params.toString()}`);
        setLocating(false);
      },
      () => {
        setError("Allow location access to find quests within 25 km.");
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <div>
      <button onClick={active ? clear : locate} disabled={locating} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${active ? "bg-white text-dark" : "border border-white/10 text-white/60"}`}>
        {locating ? <LoaderCircle size={16} className="animate-spin" /> : active ? <X size={16} /> : <LocateFixed size={16} />}
        {locating ? "Finding you…" : active ? "Nearby · 25 km" : "Nearby"}
      </button>
      {error ? <p role="alert" className="mt-2 max-w-xs text-xs text-[#ffd0c8]">{error}</p> : null}
    </div>
  );
}
