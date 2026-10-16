"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, LoaderCircle, X } from "lucide-react";
import { apiUrl, readApiError, type QuestInvitation } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function InvitationPanel({ questId }: { questId: string }) {
  const [invitations, setInvitations] = useState<QuestInvitation[]>([]);
  const [maxUses, setMaxUses] = useState(5);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) return;
    const response = await fetch(apiUrl(`/quests/${questId}/invitations`), {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (response.ok) setInvitations(await response.json() as QuestInvitation[]);
  }, [questId]);

  useEffect(() => { void load(); }, [load]);

  async function createInvitation() {
    setWorking(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Sign in again to create an invitation.");
      const response = await fetch(apiUrl(`/quests/${questId}/invitations`), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ max_uses: maxUses }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to create an invitation."));
      const invitation = await response.json() as QuestInvitation;
      setInvitations((current) => [invitation, ...current]);
      await copy(invitation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create an invitation.");
    } finally {
      setWorking(false);
    }
  }

  async function copy(invitation: QuestInvitation) {
    const link = `${window.location.origin}/invite/${invitation.token}`;
    await navigator.clipboard.writeText(link);
    setCopied(invitation.id);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function revoke(invitation: QuestInvitation) {
    setWorking(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Sign in again to revoke this invitation.");
      const response = await fetch(apiUrl(`/quests/${questId}/invitations/${invitation.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to revoke the invitation."));
      setInvitations((current) => current.map((item) => item.id === invitation.id ? { ...item, revoked_at: new Date().toISOString() } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke the invitation.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mt-5 border-t border-line pt-5">
      <div className="flex items-center gap-2"><Link2 size={17} /><h3 className="font-bold">Private invitations</h3></div>
      <p className="mt-2 text-xs leading-5 text-muted">Each accepted link grants access and joins that person to this quest. Links expire after seven days or at the quest deadline.</p>
      <div className="mt-4 flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-line px-3 text-xs font-bold">Uses<input aria-label="Maximum invitation uses" type="number" min={1} max={10} value={maxUses} onChange={(event) => setMaxUses(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} className="min-w-0 flex-1 bg-transparent py-3 text-right outline-none" /></label>
        <button onClick={createInvitation} disabled={working} className="flex items-center gap-2 rounded-xl bg-dark px-4 text-xs font-bold text-white disabled:opacity-50">{working ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />}Create link</button>
      </div>
      <div className="mt-3 space-y-2">
        {invitations.map((invitation) => {
          const inactive = Boolean(invitation.revoked_at) || new Date(invitation.expires_at) <= new Date() || invitation.use_count >= invitation.max_uses;
          return <div key={invitation.id} className="rounded-xl bg-background p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold">{invitation.use_count}/{invitation.max_uses} accepted</span><span className="text-[0.65rem] text-muted">{inactive ? "Inactive" : `Expires ${new Date(invitation.expires_at).toLocaleDateString()}`}</span></div>{!inactive ? <div className="mt-2 flex gap-2"><button onClick={() => copy(invitation)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white py-2 text-xs font-bold">{copied === invitation.id ? <Check size={14} /> : <Copy size={14} />}{copied === invitation.id ? "Copied" : "Copy link"}</button><button aria-label="Revoke invitation" onClick={() => revoke(invitation)} disabled={working} className="grid h-8 w-8 place-items-center rounded-lg border border-[#f2c7bf] bg-[#fff7f5] text-[#8f2e1e]"><X size={14} /></button></div> : null}</div>;
        })}
      </div>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-xs text-[#8f2e1e]">{error}</p> : null}
    </section>
  );
}
