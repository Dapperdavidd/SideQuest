import type { MapPin } from "./apple-map";

/**
 * The canvas map art with pins placed relative to each other. Shown while Apple Maps loads
 * and whenever MapKit is not configured.
 */
export function IllustratedMap({ pins, selectedId, onSelect, interactive = true }: { pins: MapPin[]; selectedId?: string | null; onSelect?: (id: string) => void; interactive?: boolean }) {
  const lats = pins.map((pin) => pin.latitude), lngs = pins.map((pin) => pin.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = (min: number, max: number, value: number) => (max - min < 1e-6 ? 0.5 : (value - min) / (max - min));
  return (
    <div className="sq-map absolute inset-0">
      {pins.map((pin) => {
        const x = 10 + 80 * span(minLng, maxLng, pin.longitude);
        const y = 88 - 76 * span(minLat, maxLat, pin.latitude);
        const active = pin.id === selectedId;
        const dark = pin.kind === "hunt" || pin.kind === "stop";
        const className = `absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] font-mono text-[11px] font-bold shadow-[0_6px_14px_rgba(17,17,17,0.22)] transition ${dark ? "border-inv" : "border-lime"} ${active ? (dark ? "bg-inv text-on-inv" : "bg-lime text-on-lime") : "bg-surface text-ink"}`;
        return interactive && onSelect ? (
          <button key={pin.id} type="button" onClick={() => onSelect(pin.id)} aria-label={pin.title} aria-pressed={active} className={`${className} hover:scale-110`} style={{ left: `${x}%`, top: `${y}%` }}>{pin.glyph ?? "★"}</button>
        ) : (
          <span key={pin.id} role="img" aria-label={pin.title} className={className} style={{ left: `${x}%`, top: `${y}%` }}>{pin.glyph ?? "★"}</span>
        );
      })}
    </div>
  );
}
