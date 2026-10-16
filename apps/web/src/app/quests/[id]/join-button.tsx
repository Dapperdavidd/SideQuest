"use client";

import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
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

  const disabled = loading || joined || isCreator || !isOpen;
  const label = joined ? "Quest joined" : isCreator ? "You created this quest" : !isOpen ? "Quest is closed" : "Join this quest";

  return (
    <div>
      <button onClick={join} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-4 font-bold text-dark disabled:cursor-not-allowed disabled:opacity-55">
        {loading ? <LoaderCircle size={18} className="animate-spin" /> : joined ? <Check size={18} /> : null}
        {loading ? "Joining…" : label}
      </button>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#8f2e1e]">{error}</p> : null}
      {!isCreator && isOpen ? <Link href={`/quests/${questId}/submit`} className="mt-3 block text-center text-sm font-bold underline decoration-accent decoration-2 underline-offset-4">Already joined? Submit your entry</Link> : null}
      <p className="mt-3 text-center text-xs text-muted">Joining records your interest. Only an accepted submission uses an entry slot.</p>
    </div>
  );
}
