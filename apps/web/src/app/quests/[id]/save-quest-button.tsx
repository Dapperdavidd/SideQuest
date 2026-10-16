"use client";

import { useState } from "react";
import { Bookmark, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function SaveQuestButton({ questId, initialSaved }: { questId: string; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(`/quests/${questId}`)}`);
        return;
      }
      const response = await fetch(apiUrl(`/quests/${questId}/saved`), {
        method: saved ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update this saved quest."));
      setSaved(!saved);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this saved quest.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="mt-3"><button onClick={toggle} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-bold disabled:opacity-50">{loading ? <LoaderCircle size={17} className="animate-spin" /> : saved ? <Check size={17} /> : <Bookmark size={17} />}{loading ? "Saving…" : saved ? "Saved" : "Save quest"}</button>{error ? <p role="alert" className="mt-2 text-center text-xs text-[#8f2e1e]">{error}</p> : null}</div>;
}
