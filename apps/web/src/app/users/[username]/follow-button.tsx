"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";
import { BlockButton } from "./block-button";

export function FollowButton({ userId, username, initialFollowing }: { userId: string; username: string; initialFollowing: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    void createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const response = await fetch(apiUrl(`/users/${userId}/block-state`), { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (active && response.ok) setBlocked(Boolean((await response.json() as { blocked: boolean }).blocked));
    });
    return () => { active = false; };
  }, [userId]);

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(`/users/${username}`)}`);
        return;
      }
      const response = await fetch(apiUrl(`/users/${userId}/follow`), {
        method: following ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to update this follow."));
      setFollowing(!following);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this follow.");
    } finally {
      setLoading(false);
    }
  }

  if (blocked) return <BlockButton userId={userId} username={username} initialBlocked />;
  return <div><button onClick={toggle} disabled={loading} className={`flex min-w-36 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold disabled:opacity-50 ${following ? "border border-white/15 bg-white/[0.05] text-white" : "bg-accent text-dark"}`}>{loading ? <LoaderCircle size={17} className="animate-spin" /> : following ? <Check size={17} /> : <UserPlus size={17} />}{loading ? "Updating…" : following ? "Following" : "Follow"}</button>{error ? <p role="alert" className="mt-2 text-xs text-[#ffb4a6]">{error}</p> : null}</div>;
}
