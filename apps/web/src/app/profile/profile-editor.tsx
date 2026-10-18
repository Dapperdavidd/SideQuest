"use client";

import { useState } from "react";
import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type EditableProfile = {
  username: string;
  displayName: string;
  bio: string | null;
};

export function ProfileEditor({ profile }: { profile: EditableProfile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? "");
    setError(null);
    setEditing(false);
  }

  async function save() {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedName = displayName.trim();
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      setError("Username needs 3–30 lowercase letters, numbers, or underscores.");
      return;
    }
    if (!normalizedName || [...normalizedName].length > 80) {
      setError("Display name needs 1–80 characters.");
      return;
    }
    if ([...bio].length > 240) {
      setError("Bio cannot exceed 240 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired. Sign in again to update your profile.");
      const response = await fetch(apiUrl("/users/me"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          display_name: normalizedName,
          bio: bio.trim(),
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Your profile could not be updated."));
      setUsername(normalizedUsername);
      setDisplayName(normalizedName);
      setBio(bio.trim());
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your profile could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/75 hover:border-accent hover:text-accent">
        <Pencil size={15} /> Edit profile
      </button>
    );
  }

  return (
    <div className="mt-7 max-w-xl rounded-2xl border border-white/10 bg-black/20 p-5">
      <h2 className="font-display text-lg font-bold">Profile settings</h2>
      <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-accent" />
      </label>
      <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Username
        <span className="mt-2 flex items-center rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-accent"><span className="text-sm text-white/35">@</span><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} minLength={3} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-normal normal-case tracking-normal text-white outline-none" /></span>
      </label>
      <label className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-white/45">Bio
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={240} rows={4} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-accent" />
        <span className="mt-1 block text-right text-[0.68rem] font-normal normal-case tracking-normal text-white/35">{[...bio].length}/240</span>
      </label>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-[#4a211b] p-3 text-sm leading-5 text-[#ffb8aa]">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-dark disabled:opacity-50">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Saving…" : "Save profile"}</button>
        <button type="button" onClick={cancel} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white/70 disabled:opacity-50"><X size={16} />Cancel</button>
      </div>
    </div>
  );
}
