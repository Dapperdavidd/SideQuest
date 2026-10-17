"use client";

import { useState } from "react";
import { Ban, LoaderCircle, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function BlockButton({ userId, username, initialBlocked }: { userId: string; username: string; initialBlocked: boolean }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!blocked && !window.confirm(`Block @${username}? Following connections in both directions will be removed.`)) return;
    setWorking(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(`/users/${username}`)}`);
        return;
      }
      const response = await fetch(apiUrl(`/users/${userId}/block`), { method: blocked ? "DELETE" : "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error(await readApiError(response, "The block could not be updated."));
      setBlocked(!blocked);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The block could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  return <div><button onClick={toggle} disabled={working} className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50">{working ? <LoaderCircle className="animate-spin" size={14} /> : blocked ? <UserRoundCheck size={14} /> : <Ban size={14} />}{blocked ? "Unblock profile" : "Block profile"}</button>{error ? <p role="alert" className="mt-2 text-xs text-[#ffb4a6]">{error}</p> : null}</div>;
}
