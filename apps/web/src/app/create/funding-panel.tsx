"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, readApiError } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

type FundingIntent = {
  id: string;
  amount_luna: number;
  amount_nim: string;
  status: "CREATED" | "PENDING" | "CONFIRMED" | "FAILED" | "EXPIRED";
  network: "testnet";
  treasury_address: string;
  payment_reference: string;
  minimum_confirmations: number;
  expires_at: string;
};

type VerificationResult = {
  intent: FundingIntent;
  transaction: { state: string; confirmations: number; transaction_hash: string };
  quest_opened: boolean;
};

async function accessToken() {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session) throw new Error("Sign in again before funding this quest.");
  return session.access_token;
}

export function FundingPanel({ questId }: { questId: string }) {
  const router = useRouter();
  const [intent, setIntent] = useState<FundingIntent | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [submittedHash, setSubmittedHash] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (intentId = intent?.id) => {
    if (!intentId) return;
    const token = await accessToken();
    const response = await fetch(apiUrl(`/funding-intents/${intentId}/refresh`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await readApiError(response, "Funding confirmation could not be refreshed."));
    const result = await response.json() as VerificationResult;
    setIntent(result.intent);
    setVerification(result);
    if (result.quest_opened) {
      router.push(`/quests/${questId}`);
      router.refresh();
    }
  }, [intent?.id, questId, router]);

  useEffect(() => {
    if (intent?.status !== "PENDING") return;
    const timer = window.setInterval(() => {
      refresh(intent.id).catch((caught) => setError(caught instanceof Error ? caught.message : "Funding confirmation could not be refreshed."));
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [intent?.id, intent?.status, refresh]);

  async function verifyHash(intentId: string, transactionHash: string) {
    setWorking(true);
    setError(null);
    try {
      const token = await accessToken();
      const verificationResponse = await fetch(apiUrl(`/funding-intents/${intentId}/transactions`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transaction_hash: transactionHash }),
      });
      if (!verificationResponse.ok) throw new Error(await readApiError(verificationResponse, "The transaction has not reached the verifier yet. Try again shortly."));
      const result = await verificationResponse.json() as VerificationResult;
      setIntent(result.intent);
      setVerification(result);
      if (result.quest_opened) {
        router.push(`/quests/${questId}`);
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The transaction has not reached the verifier yet.");
    } finally {
      setWorking(false);
    }
  }

  async function fund() {
    setWorking(true);
    setError(null);
    try {
      const token = await accessToken();
      const intentResponse = await fetch(apiUrl(`/quests/${questId}/funding-intents`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!intentResponse.ok) throw new Error(await readApiError(intentResponse, "A funding request could not be prepared."));
      const nextIntent = await intentResponse.json() as FundingIntent;
      setIntent(nextIntent);

      const { getHostNetwork, init } = await import("@nimiq/mini-app-sdk");
      if (getHostNetwork() !== "testnet") {
        throw new Error("Open SideQuest inside Nimiq Pay with its developer network set to Testnet, then try again.");
      }
      const provider = await init();
      const transactionHash = await provider.sendBasicTransactionWithData({
        recipient: nextIntent.treasury_address,
        value: nextIntent.amount_luna,
        data: nextIntent.payment_reference,
      });
      if (typeof transactionHash !== "string") throw new Error("Nimiq Pay did not return a transaction hash.");
      setSubmittedHash(transactionHash);
      await verifyHash(nextIntent.id, transactionHash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reward pool could not be funded.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-5 rounded-[1.25rem] border border-[#cde66c] bg-accent-soft p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent"><ShieldCheck size={20} /></span>
        <div><h2 className="font-display text-lg font-bold">Fund the verified reward pool</h2><p className="mt-1 text-sm leading-6 text-muted">Nimiq Pay will show the exact Testnet recipient and amount before you approve. SideQuest opens the quest only after independent confirmation.</p></div>
      </div>
      {intent ? <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-white/75 p-3"><span className="block text-xs text-muted">Total</span><strong>{intent.amount_nim} NIM</strong></div><div className="rounded-xl bg-white/75 p-3"><span className="block text-xs text-muted">Status</span><strong>{intent.status.replaceAll("_", " ")}</strong></div></div> : null}
      {verification && !verification.quest_opened ? <p className="mt-4 flex items-center gap-2 text-sm font-semibold"><LoaderCircle size={16} className="animate-spin" />Transaction {verification.transaction.state}; {verification.transaction.confirmations}/{intent?.minimum_confirmations ?? 2} confirmations.</p> : null}
      {verification?.quest_opened ? <p className="mt-4 flex items-center gap-2 text-sm font-bold"><Check size={17} />Funding confirmed. Opening your quest…</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-[#8f2e1e]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={fund} disabled={working || Boolean(submittedHash) || intent?.status === "PENDING" || intent?.status === "CONFIRMED"} className="flex items-center gap-2 rounded-full bg-dark px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{working ? <LoaderCircle size={17} className="animate-spin" /> : <WalletCards size={17} />}{working ? "Opening Nimiq Pay…" : "Fund with Nimiq Pay"}</button>{submittedHash && intent?.status === "CREATED" ? <button onClick={() => verifyHash(intent.id, submittedHash)} disabled={working} className="rounded-full border border-dark/20 px-5 py-3 text-sm font-bold disabled:opacity-40">Retry verification</button> : null}{intent?.status === "PENDING" ? <button onClick={() => refresh()} className="rounded-full border border-dark/20 px-5 py-3 text-sm font-bold">Check confirmation</button> : null}</div>
    </div>
  );
}
