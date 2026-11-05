import { Suspense } from "react";
import { MapExplorer } from "@/components/map/map-explorer";
import { listQuests, type Quest } from "@/lib/api/quests";

export const metadata = { title: "Map", robots: { index: false } };

/**
 * Chrome-less Apple Maps view for the Android app's WebView (iOS uses native MapKit).
 * Marker taps are posted to the `SideQuestBridge` JavaScript channel.
 */
export default function EmbeddedMapPage(props: PageProps<"/embed/map">) {
  return <Suspense fallback={<main className="h-[100svh] bg-bg" />}><EmbeddedMap {...props} /></Suspense>;
}

async function EmbeddedMap({ searchParams }: PageProps<"/embed/map">) {
  const { lat, lng, theme } = await searchParams;
  const latitude = Number(lat), longitude = Number(lng);
  const located = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const quests = await listQuests({ questType: "BOUNTY", latitude: located ? latitude : undefined, longitude: located ? longitude : undefined, radiusKm: 50 }).catch(() => [] as Quest[]);
  return (
    <main className="h-[100svh] overflow-hidden bg-bg" data-theme-request={theme === "dark" ? "dark" : theme === "light" ? "light" : undefined}>
      {theme === "dark" || theme === "light" ? <script dangerouslySetInnerHTML={{ __html: `document.documentElement.dataset.theme=${JSON.stringify(theme)}` }} /> : null}
      <MapExplorer quests={quests.filter((quest) => quest.status === "OPEN")} embedded />
    </main>
  );
}
