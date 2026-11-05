"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-toggle";

export type MapPin = {
  id: string;
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  /** Short text inside the marker, such as the reward amount. */
  glyph?: string;
  kind: "bounty" | "hunt" | "stop" | "you";
};

type AppleMapProps = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Rendered while MapKit loads, and permanently when Apple Maps is not configured. */
  fallback: React.ReactNode;
  className?: string;
  showsUserLocation?: boolean;
};

/* Minimal typing for the parts of MapKit JS this component uses. */
type MapKitCoordinate = { latitude: number; longitude: number };
type MapKitAnnotation = { data: { id: string }; selected: boolean };
type MapKitMap = {
  colorScheme: string;
  annotations: MapKitAnnotation[];
  addEventListener: (type: string, listener: (event: { annotation?: MapKitAnnotation }) => void) => void;
  showItems: (items: MapKitAnnotation[], options?: { animate?: boolean; padding?: unknown }) => void;
  removeAnnotations: (items: MapKitAnnotation[]) => void;
  addAnnotations: (items: MapKitAnnotation[]) => void;
  destroy: () => void;
  showsUserLocation: boolean;
};
type MapKit = {
  init: (options: { authorizationCallback: (done: (token: string) => void) => void; language?: string }) => void;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapKitMap & { constructor: { ColorSchemes: Record<string, string> } };
  Coordinate: new (latitude: number, longitude: number) => MapKitCoordinate;
  MarkerAnnotation: new (coordinate: MapKitCoordinate, options: Record<string, unknown>) => MapKitAnnotation;
  Padding: new (top: number, right: number, bottom: number, left: number) => unknown;
  FeatureVisibility: Record<string, string>;
};

declare global {
  interface Window {
    mapkit?: MapKit;
  }
}

const MAPKIT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
let loader: Promise<MapKit | null> | null = null;

/** Loads MapKit JS once and authorizes it with a token from our own endpoint. */
function loadMapKit(): Promise<MapKit | null> {
  if (loader) return loader;
  loader = (async () => {
    const probe = await fetch("/api/mapkit/token", { cache: "no-store" }).catch(() => null);
    if (!probe?.ok) return null;
    const firstToken = await probe.text();
    if (!window.mapkit) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = MAPKIT_SRC;
        script.crossOrigin = "anonymous";
        script.dataset.libraries = "map,annotations,user-location";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("MapKit JS failed to load"));
        document.head.appendChild(script);
      });
      await new Promise<void>((resolve) => {
        const check = () => (window.mapkit?.Map ? resolve() : window.setTimeout(check, 50));
        check();
      });
    }
    const mapkit = window.mapkit!;
    let useFirst = true;
    mapkit.init({
      language: "en",
      authorizationCallback: (done) => {
        if (useFirst) {
          useFirst = false;
          done(firstToken);
          return;
        }
        void fetch("/api/mapkit/token", { cache: "no-store" }).then((response) => response.text()).then(done);
      },
    });
    return mapkit;
  })().catch(() => null);
  return loader;
}

const colors = { bounty: "#E0FE5E", hunt: "#111111", stop: "#111111", you: "#2F6BFF" } as const;
const glyphColors = { bounty: "#111111", hunt: "#E0FE5E", stop: "#E0FE5E", you: "#FFFFFF" } as const;

/** Apple Maps through MapKit JS, styled to follow the app's light or dark theme. */
export function AppleMap({ pins, selectedId, onSelect, fallback, className = "", showsUserLocation = false }: AppleMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapKitMap | null>(null);
  const kitRef = useRef<MapKit | null>(null);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const theme = useTheme();

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    void loadMapKit().then((mapkit) => {
      if (cancelled) return;
      if (!mapkit || !container.current) return setStatus("unavailable");
      kitRef.current = mapkit;
      const map = new mapkit.Map(container.current, {
        showsCompass: mapkit.FeatureVisibility.Adaptive,
        showsZoomControl: true,
        showsMapTypeControl: false,
        isRotationEnabled: false,
        showsPointsOfInterest: true,
      });
      map.addEventListener("select", (event) => {
        const id = event.annotation?.data?.id;
        if (id && id !== "you") onSelectRef.current?.(id);
      });
      mapRef.current = map;
      setStatus("ready");
    });
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.colorScheme = theme === "dark" ? "dark" : "light";
  }, [theme, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.showsUserLocation = showsUserLocation;
  }, [showsUserLocation, status]);

  useEffect(() => {
    const map = mapRef.current, mapkit = kitRef.current;
    if (!map || !mapkit) return;
    map.removeAnnotations(map.annotations);
    const annotations = pins.map((pin) => {
      const annotation = new mapkit.MarkerAnnotation(new mapkit.Coordinate(pin.latitude, pin.longitude), {
        title: pin.title,
        subtitle: pin.subtitle,
        glyphText: pin.glyph ?? (pin.kind === "hunt" ? "H" : pin.kind === "stop" ? "•" : "★"),
        color: colors[pin.kind],
        glyphColor: glyphColors[pin.kind],
        data: { id: pin.id },
        selected: pin.id === selectedId,
      });
      return annotation;
    });
    map.addAnnotations(annotations);
    if (annotations.length) map.showItems(annotations, { animate: false, padding: new mapkit.Padding(64, 48, 64, 48) });
  }, [pins, selectedId, status]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={container} className={`absolute inset-0 ${status === "ready" ? "" : "invisible"}`} aria-label="Apple Maps" role="application" />
      {status !== "ready" ? <div className="absolute inset-0">{fallback}</div> : null}
    </div>
  );
}
