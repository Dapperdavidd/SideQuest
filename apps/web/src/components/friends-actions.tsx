"use client";

import { Check, LoaderCircle, LogOut, Plus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

async function call(path: string, method: string, body?: unknown) {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session) throw new Error("Sign in again to continue.");
  const response = await fetch(apiUrl(path), {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await readApiError(response, "That didn't work. Try again."));
  return response.status === 204 ? null : response.json();
}

function useAction() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<unknown>, after?: (result: unknown) => void) => {
    setWorking(true);
    setError(null);
    try {
      const result = await task();
      after?.(result);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setWorking(false);
    }
  };
  return { working, error, run, router };
}

export function AddFriendForm() {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { working, error, run } = useAction();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    run(() => call("/friends/requests", "POST", { username: username.trim() }), (result) => {
      const state = (result as { state?: string } | null)?.state;
      setSent(state === "ACCEPTED" ? "You're friends now." : "Request sent.");
      setUsername("");
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="add-friend" className="sr-only">Friend&apos;s username</label>
      <div className="flex gap-2">
        <input id="add-friend" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@username" autoCapitalize="none" className="sq-input !min-h-11 flex-1" />
        <button type="submit" disabled={working || !username.trim()} className="sq-btn sq-btn-inv !min-h-11 !px-4 !text-[11px]">{working ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}Add</button>
      </div>
      {sent ? <span role="status" className="text-xs font-semibold">{sent}</span> : null}
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </form>
  );
}

export function FriendRequestActions({ userId, incoming }: { userId: string; incoming: boolean }) {
  const { working, run } = useAction();
  return (
    <span className="flex gap-1.5">
      {incoming ? <button type="button" disabled={working} onClick={() => run(() => call(`/friends/requests/${userId}/accept`, "POST"))} aria-label="Accept friend request" className="grid h-9 w-9 place-items-center rounded-full bg-lime text-on-lime"><Check size={16} aria-hidden="true" /></button> : null}
      <button type="button" disabled={working} onClick={() => run(() => call(`/friends/${userId}`, "DELETE"))} aria-label={incoming ? "Decline friend request" : "Cancel friend request"} className="grid h-9 w-9 place-items-center rounded-full border border-line"><X size={16} aria-hidden="true" /></button>
    </span>
  );
}

export function NewGroupForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { working, error, run, router } = useAction();
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2.5 rounded-xl p-2.5 text-[15px] font-semibold hover:bg-sunken"><span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-dashed border-line"><Plus size={16} aria-hidden="true" /></span>New group</button>;
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); run(() => call("/friends/groups", "POST", { name: name.trim() }), (group) => router.push(`/friends/groups/${(group as { id: string }).id}`)); }} className="flex flex-col gap-2 p-2">
      <label htmlFor="group-name" className="sq-field-label">Group name</label>
      <input id="group-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Lekki Crew" className="sq-input !min-h-11" autoFocus />
      <div className="flex gap-2"><button type="submit" disabled={working || name.trim().length < 2} className="sq-btn sq-btn-lime !min-h-11 flex-1 !text-[11px]">Create</button><button type="button" onClick={() => setOpen(false)} className="sq-btn sq-btn-ghost !min-h-11 !text-[11px]">Cancel</button></div>
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </form>
  );
}

export function LeaveGroupButton({ groupId, owner }: { groupId: string; owner: boolean }) {
  const { working, error, run, router } = useAction();
  return (
    <span className="flex flex-col gap-1">
      <button type="button" disabled={working} onClick={() => run(() => call(`/friends/groups/${groupId}/members/me`, "DELETE"), () => router.push("/friends"))} className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-danger"><LogOut size={14} aria-hidden="true" />{owner ? "Close group" : "Leave group"}</button>
      {error ? <span role="alert" className="text-xs text-danger">{owner ? "Owners can close a group once everyone else has left." : error}</span> : null}
    </span>
  );
}

export function JoinGroupButton({ code }: { code: string }) {
  const { working, error, run, router } = useAction();
  return (
    <span className="flex flex-col gap-2">
      <button type="button" disabled={working} onClick={() => run(() => call(`/g/${code}/join`, "POST"), (group) => router.push(`/friends/groups/${(group as { id: string }).id}`))} className="sq-btn sq-btn-lime h-[54px] w-full">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}Join the group</button>
      {error ? <span role="alert" className="text-sm text-danger">{error}</span> : null}
    </span>
  );
}

export function CastVoteButton({ questId, entryId, label }: { questId: string; entryId: string | null; label: string }) {
  const { working, error, run } = useAction();
  return (
    <span className="flex flex-col gap-2">
      <button type="button" disabled={working || !entryId} onClick={() => entryId && run(() => call(`/quests/${questId}/vote`, "POST", { entry_id: entryId }))} className="sq-btn sq-btn-lime h-[58px] w-full">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} strokeWidth={2.6} aria-hidden="true" />}{label}</button>
      {error ? <span role="alert" className="text-center text-sm text-danger">{error}</span> : null}
    </span>
  );
}
