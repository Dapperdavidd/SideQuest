"use client";

import { Check, Clock3, LoaderCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type State = "NONE" | "ACCEPTED" | "INCOMING" | "OUTGOING";

/** Mutual friend control: add, accept, or show the current friendship state. */
export function FriendButton({ userId, username, initialState }: { userId: string; username: string; initialState: State }) {
  const router = useRouter();
  const [state, setState] = useState<State>(initialState);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act() {
    setWorking(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) return router.push(`/auth?next=${encodeURIComponent(`/users/${username}`)}`);
      const response = state === "INCOMING"
        ? await fetch(apiUrl(`/friends/requests/${userId}/accept`), { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } })
        : await fetch(apiUrl("/friends/requests"), { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      if (!response.ok) throw new Error(await readApiError(response, "That didn't work. Try again."));
      const result = await response.json() as { state: State };
      setState(result.state);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setWorking(false);
    }
  }

  if (state === "ACCEPTED") return <span className="sq-btn sq-btn-ghost"><Check size={16} aria-hidden="true" />Friends</span>;
  if (state === "OUTGOING") return <span className="sq-btn sq-btn-ghost text-ink-2"><Clock3 size={16} aria-hidden="true" />Requested</span>;
  return (
    <span className="flex flex-col gap-1.5">
      <button type="button" onClick={act} disabled={working} className="sq-btn sq-btn-lime">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{state === "INCOMING" ? "Accept friend request" : "Add friend"}</button>
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
