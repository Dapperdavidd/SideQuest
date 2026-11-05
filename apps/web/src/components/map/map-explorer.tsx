"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, LocateFixed } from "lucide-react";
import { isHunt, rewardAmount, type Quest } from "@/lib/api/quests";
import { AppleMap, type MapPin } from "./apple-map";
import { IllustratedMap } from "./illustrated-map";

type MapExplorerProps = {
  quests: Quest[];
  /** Embedded in the mobile app: no side panel, taps go to the native quest screen. */
  embedded?: boolean;
};

declare global {
  interface Window {
    SideQuestBridge?: { postMessage: (message: string) => void };
  }
}

export function questPins(quests: Quest[]): MapPin[] {
  return quests
    .filter((quest) => quest.latitude !== null && quest.longitude !== null)
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      subtitle: [quest.organization_display_name ?? quest.creator_display_name, rewardAmount(quest)].filter(Boolean).join(" · "),
      latitude: quest.latitude!,
      longitude: quest.longitude!,
      glyph: rewardAmount(quest)?.replace(" NIM", "") ?? "★",
      kind: isHunt(quest) ? "hunt" : "bounty",
    }));
}

/** Apple directions to a place: opens Apple Maps on Apple devices and maps.apple.com elsewhere. */
export function appleDirectionsUrl(latitude: number, longitude: number, name: string) {
  return `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(name)}`;
}

export function MapExplorer({ quests, embedded = false }: MapExplorerProps) {
  const pins = useMemo(() => questPins(quests), [quests]);
  const [selectedId, setSelectedId] = useState<string | null>(pins[0]?.id ?? null);
  const [locating, setLocating] = useState(false);
  const [showsUser, setShowsUser] = useState(false);
  const active = quests.find((quest) => quest.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId(id);
    if (embedded && window.SideQuestBridge) window.SideQuestBridge.postMessage(JSON.stringify({ type: "select", questId: id }));
  }

  function locate() {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(() => { setShowsUser(true); setLocating(false); }, () => setLocating(false), { timeout: 10_000 });
  }

  const map = (
    <AppleMap
      pins={pins}
      selectedId={selectedId}
      onSelect={select}
      showsUserLocation={showsUser}
      className={embedded ? "h-full w-full" : "min-h-[420px] min-w-0 flex-[999_1_560px] rounded-[28px] border border-line"}
      fallback={pins.length ? <IllustratedMap pins={pins} selectedId={selectedId} onSelect={select} /> : <div className="sq-map absolute inset-0 grid place-items-center p-6 text-center"><p className="sq-card max-w-sm p-5 text-sm text-ink-2">No bounties with a place yet. Bounties show here when their creator adds a location.</p></div>}
    />
  );

  if (embedded) {
    return (
      <div className="relative h-[100svh] w-full">
        {map}
        {active ? (
          <div className="absolute inset-x-3 bottom-4 flex items-center gap-3 rounded-[22px] bg-surface p-4 shadow-[var(--shadow-pop)]">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-display text-lg font-black uppercase leading-none tracking-[-0.03em]">{active.title}</span>
              <span className="truncate text-xs text-ink-2">{[rewardAmount(active) ?? "Recognition", isHunt(active) ? `${active.checkpoint_count} stops` : null, active.location_name].filter(Boolean).join(" · ")}</span>
            </div>
            <a href={`/quests/${active.id}`} onClick={(event) => { if (window.SideQuestBridge) { event.preventDefault(); window.SideQuestBridge.postMessage(JSON.stringify({ type: "open", questId: active.id })); } }} className="sq-btn sq-btn-lime !min-h-11 !px-4 !text-[11px]">View</a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-wrap gap-5">
      <div className="relative flex min-w-0 flex-[999_1_560px] flex-col">
        {map}
        <div className="pointer-events-none absolute left-4 top-4 flex gap-2 rounded-full bg-surface/90 px-3 py-2 text-xs font-bold shadow-[var(--shadow-card)] backdrop-blur"><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-lime" />Bounty</span><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-[3px] border-inv" />Hunt</span></div>
        <button type="button" onClick={locate} className="sq-btn sq-btn-inv absolute bottom-4 right-4 !min-h-11 !px-4 !text-[11px]"><LocateFixed size={15} aria-hidden="true" />{locating ? "Finding you…" : "Near me"}</button>
      </div>
      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
        {active ? (
          <article className="sq-card flex flex-col gap-3 p-5">
            <span className={`sq-sticker self-start ${isHunt(active) ? "sq-sticker-inv" : "sq-sticker-lime"}`}>{isHunt(active) ? `Hunt · ${active.checkpoint_count} stops` : "Bounty"}</span>
            <h2 className="font-display text-[28px] font-black uppercase leading-[0.9] tracking-[-0.04em]">{active.title}</h2>
            <span className="text-sm text-ink-2">{[active.organization_display_name ?? active.creator_display_name, active.location_name].filter(Boolean).join(" · ")}</span>
            <div className="flex items-center justify-between"><span className="font-display text-2xl font-black">{rewardAmount(active) ?? "Glory"}</span><span className="font-mono text-xs font-bold">{Math.max(0, active.max_entries - active.entries_received)}/{active.max_entries} SPOTS</span></div>
            <div className="flex gap-2">
              <Link href={`/quests/${active.id}`} className="sq-btn sq-btn-lime flex-1">View</Link>
              {active.latitude !== null && active.longitude !== null ? <a href={appleDirectionsUrl(active.latitude, active.longitude, active.location_name ?? active.title)} target="_blank" rel="noreferrer" className="sq-btn sq-btn-ghost"><ExternalLink size={15} aria-hidden="true" />Directions</a> : null}
            </div>
          </article>
        ) : null}
        <ol className="sq-card flex flex-col p-2">
          {quests.slice(0, 14).map((quest) => (
            <li key={quest.id}><button type="button" onClick={() => select(quest.id)} aria-pressed={selectedId === quest.id} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-sunken ${selectedId === quest.id ? "bg-lime-tint" : ""}`}><span className="truncate">{quest.title}</span><span className="shrink-0 font-mono text-xs text-ink-2">{quest.latitude === null ? "ONLINE" : quest.distance_km !== null ? `${quest.distance_km.toFixed(1)} KM` : "PIN"}</span></button></li>
          ))}
          {!quests.length ? <li className="p-3 text-sm text-ink-2">No open bounties right now.</li> : null}
        </ol>
      </aside>
    </div>
  );
}
