"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type Settings = { profile_visibility: "PUBLIC" | "PRIVATE"; challenge_permission: "FRIENDS" | "NOBODY"; group_invite_permission: "FRIENDS" | "NOBODY" };

const rows = [
  { key: "profile_visibility", label: "Profile", hint: "Private shows your quest record and friends only to friends.", options: [["PUBLIC", "Public"], ["PRIVATE", "Private"]] },
  { key: "challenge_permission", label: "Who can challenge you", hint: "Friends challenges sent to all friends skip people set to Nobody.", options: [["FRIENDS", "Friends"], ["NOBODY", "Nobody"]] },
  { key: "group_invite_permission", label: "Who can add you to groups", hint: "You can always join a group yourself with an invite link.", options: [["FRIENDS", "Friends"], ["NOBODY", "Nobody"]] },
] as const;

export function PrivacySettings({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(key: keyof Settings, value: string) {
    const previous = settings;
    setSettings({ ...settings, [key]: value } as Settings);
    setSaving(key);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Sign in again to change settings.");
      const response = await fetch(apiUrl("/users/me"), { method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
      if (!response.ok) throw new Error(await readApiError(response, "That setting could not be saved."));
      setSaved(key);
      window.setTimeout(() => setSaved(null), 1500);
    } catch (caught) {
      setSettings(previous);
      setError(caught instanceof Error ? caught.message : "That setting could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map(({ key, label, hint, options }) => (
        <fieldset key={key} className="flex flex-col gap-2">
          <legend className="flex items-center gap-2 pb-2 text-sm font-bold">{label}{saving === key ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : saved === key ? <Check size={13} aria-label="Saved" /> : null}</legend>
          <div className="flex rounded-full bg-sunken p-1">
            {options.map(([value, text]) => (
              <button key={value} type="button" aria-pressed={settings[key] === value} onClick={() => settings[key] !== value && update(key, value)} className={`h-9 flex-1 rounded-full text-xs font-extrabold uppercase tracking-[0.12em] transition ${settings[key] === value ? "bg-surface shadow-[var(--shadow-card)]" : "text-ink-2"}`}>{text}</button>
            ))}
          </div>
          <span className="text-xs text-ink-3">{hint}</span>
        </fieldset>
      ))}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
