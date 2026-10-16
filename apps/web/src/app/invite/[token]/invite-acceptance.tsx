"use client";

import { useState } from "react";
import { Link2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function InviteAcceptance({ token }: { token: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setWorking(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) {
        router.push(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      const response = await fetch(apiUrl(`/invitations/${encodeURIComponent(token)}/accept`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, "This invitation cannot be accepted."));
      const result = await response.json() as { quest_id: string };
      router.replace(`/quests/${result.quest_id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This invitation cannot be accepted.");
      setWorking(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground"><section className="w-full max-w-md rounded-[1.75rem] border border-line bg-white p-7 text-center shadow-[0_24px_80px_rgba(23,25,23,0.08)] sm:p-9"><div className="flex justify-center"><Logo /></div><span className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full bg-accent-soft"><Link2 size={26} /></span><h1 className="mt-6 font-display text-3xl font-bold">You&apos;re invited</h1><p className="mt-3 text-sm leading-6 text-muted">Accept this private invitation to see the quest details and join the challenge.</p><button onClick={accept} disabled={working} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-4 font-bold text-dark disabled:opacity-50">{working ? <LoaderCircle size={18} className="animate-spin" /> : <Link2 size={18} />}{working ? "Accepting…" : "Accept invitation"}</button>{error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#8f2e1e]">{error}</p> : null}</section></main>;
}
