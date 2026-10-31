import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getMyPayouts, type PayoutSummary } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export default function WalletPage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-[#101310]" />}><WalletExperience /></Suspense>;
}

async function WalletExperience() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/wallet");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth?next=/wallet");
  const payouts = await getMyPayouts(session.access_token);
  const confirmedLuna = payouts.filter((payout) => payout.payout_kind === "WINNER_REWARD" && payout.status === "CONFIRMED").reduce((sum, payout) => sum + payout.amount_luna, 0);

  return (
    <AppShell active="wallet" viewer={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl }}>
      <div className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9"><div className="mx-auto max-w-5xl">
          <p className="app-eyebrow">Your quest rewards</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.05em]">Rewards</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">See what you have earned and where each reward is going.</p>

          <section className="mt-8 rounded-[1.5rem] bg-dark p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-black/50">Confirmed rewards</p><strong className="mt-2 block font-display text-4xl tracking-tight">{formatLuna(confirmedLuna)} NIM</strong></div><span className="grid h-12 w-12 place-items-center rounded-full bg-accent"><WalletCards size={23} /></span></div>
            <p className="mt-6 text-xs text-white/45">Rewards currently use testnet NIM, which has no monetary value.</p>
          </section>

          <div className="mt-10 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Reward activity</h2><span className="text-sm text-muted">{payouts.length} total</span></div>
          {payouts.length ? <div className="mt-4 space-y-3">{payouts.map((payout) => <PayoutCard key={payout.id} payout={payout} />)}</div> : (
            <div className="app-card mt-4 rounded-[1.25rem] px-6 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent"><Clock3 size={22} /></span><h3 className="mt-4 font-display text-xl font-bold">No rewards yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Complete a reward quest and your payout progress will appear here.</p><Link href="/discover" className="mt-5 inline-block rounded-full bg-dark px-5 py-2.5 text-sm font-bold text-white">Find a reward quest</Link></div>
          )}
      </div></div>
    </AppShell>
  );
}

function PayoutCard({ payout }: { payout: PayoutSummary }) {
  const confirmed = payout.status === "CONFIRMED";
  const refund = payout.payout_kind === "CREATOR_REFUND";
  return <article className="app-card rounded-[1.25rem] p-5"><div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${confirmed ? "bg-accent text-dark" : "bg-black/5 text-muted"}`}>{confirmed ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display font-bold">{payout.quest_title}</h3><p className="mt-1 text-xs text-muted">{refund ? "Unused reward returned" : "Quest reward"} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(payout.created_at))}</p></div><strong className="text-lg">+{payout.amount_nim} NIM</strong></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-black/10 px-2.5 py-1 font-semibold">{payout.status.toLowerCase()}</span><span className="text-muted">To {shortAddress(payout.destination_address)}</span>{payout.transaction_hash ? <span className="ml-auto font-mono text-muted" title={payout.transaction_hash}>Tx {payout.transaction_hash.slice(0, 10)}…</span> : null}</div>{payout.failure_reason ? <p className="mt-3 text-xs text-[#a33d2c]">{payout.failure_reason}</p> : null}</div></div></article>;
}

function formatLuna(luna: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 5 }).format(luna / 100_000);
}

function shortAddress(address: string) {
  return `${address.slice(0, 9)}…${address.slice(-9)}`;
}
