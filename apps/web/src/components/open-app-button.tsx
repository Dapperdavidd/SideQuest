"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Until the native apps ship, "Open app" installs the PWA when the browser offers it
 * and otherwise opens the web app directly.
 */
export function OpenAppButton({ className = "" }: { className?: string }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  const label = <>Open app<ArrowUpRight size={16} strokeWidth={2.4} aria-hidden="true" /></>;

  if (installEvent) {
    return (
      <button
        type="button"
        className={className}
        onClick={async () => {
          await installEvent.prompt();
          await installEvent.userChoice.catch(() => null);
          setInstallEvent(null);
        }}
      >
        {label}
      </button>
    );
  }

  return <Link href="/discover" className={className}>{label}</Link>;
}
