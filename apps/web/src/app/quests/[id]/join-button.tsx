"use client";

import { useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type JoinButtonProps = {
  questId: string;
  isCreator: boolean;
  isOpen: boolean;
  initialJoined?: boolean;
};

export function JoinButton({ questId, isCreator, isOpen, initialJoined = false }: JoinButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(initialJoined);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(`/quests/${questId}`)}`);
        return;
      }
      const response = await fetch(apiUrl(`/quests/${questId}/join`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to join this quest."));
      setJoined(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to join this quest.");
    } finally {
      setLoading(false);
    }
  }

  if (joined && isOpen && !isCreator) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={`/quests/${questId}/submit`} className="sq-btn sq-btn-inv h-[58px] w-full">Submit your entry<ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" /></Link>
        <span className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]"><Check size={14} aria-hidden="true" />You joined this quest</span>
      </div>
    );
  }

  const disabled = loading || isCreator || !isOpen;
  const label = isCreator ? "You created this quest" : !isOpen ? "Quest is closed" : "Join quest";

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={join} disabled={disabled} className="sq-btn sq-btn-inv h-[58px] w-full">
        {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : null}
        {loading ? "Joining…" : label}
        {!loading && !disabled ? <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" /> : null}
      </button>
      {error ? <p role="alert" className="rounded-2xl bg-surface px-4 py-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
