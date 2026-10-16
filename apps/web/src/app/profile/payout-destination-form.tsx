"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type PayoutDestination = {
  network: "testnet";
  address: string;
  updated_at: string;
};

async function accessToken() {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session) throw new Error("Sign in again before changing your payout address.");
  return session.access_token;
}

export function PayoutDestinationForm() {
  const [address, setAddress] = useState("");
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const token = await accessToken();
        const response = await fetch(apiUrl("/users/me/payout-destination"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) return;
        if (!response.ok) throw new Error(await readApiError(response, "Your payout destination could not be loaded."));
        const destination = await response.json() as PayoutDestination;
        if (active) {
          setAddress(destination.address);
          setSavedAddress(destination.address);
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Your payout destination could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const token = await accessToken();
      const response = await fetch(apiUrl("/users/me/payout-destination"), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "That Nimiq address could not be saved."));
      const destination = await response.json() as PayoutDestination;
      setAddress(destination.address);
      setSavedAddress(destination.address);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That Nimiq address could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="mt-5 flex items-center gap-2 text-sm text-white/45"><LoaderCircle size={16} className="animate-spin" />Loading destination…</p>;

  return (
    <div className="mt-5">
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">Testnet address<input value={address} onChange={(event) => setAddress(event.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="NQ00 0000 0000 0000 0000 0000 0000 0000 0000" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm font-normal tracking-wide text-white outline-none placeholder:text-white/20 focus:border-accent" /></label>
      {savedAddress === address && savedAddress ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent"><Check size={16} />Saved for TestAlbatross rewards</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-[#3c1f1a] p-3 text-sm leading-6 text-[#ffc0b5]">{error}</p> : null}
      <button onClick={save} disabled={saving || !address.trim() || address === savedAddress} className="mt-4 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark disabled:cursor-not-allowed disabled:opacity-40">{saving ? <LoaderCircle size={16} className="animate-spin" /> : null}{saving ? "Validating…" : "Save payout address"}</button>
    </div>
  );
}
