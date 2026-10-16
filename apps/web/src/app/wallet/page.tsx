import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle2, Clock3, WalletCards } from "lucide-react";
import { Logo } from "@/components/logo";
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
  const confirmedLuna = payouts.filter((payout) => payout.status === "CONFIRMED").reduce((sum, payout) => sum + payout.amount_luna, 0);

  return (
    <main className="min-h-screen bg-[#101310] p-3 text-white sm:p-5">
      <div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#151815]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
          <Link href="/discover" className="flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={18} />Discover</Link>
          <Logo inverse />
          <Link href="/profile" className="text-sm text-white/65 hover:text-white">Profile</Link>
        </header>
        <div className="px-5 py-8 sm:px-10 sm:py-12">
          <p className="text-sm font-semibold text-accent">Nimiq Testnet</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em]">Reward wallet</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Track rewards allocated to you and their journey from SideQuest escrow to your saved NIM address.</p>

          <section className="mt-8 rounded-[1.5rem] bg-white p-6 text-dark sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-black/50">Confirmed rewards</p><strong className="mt-2 block font-display text-4xl tracking-tight">{formatLuna(confirmedLuna)} NIM</strong></div><span className="grid h-12 w-12 place-items-center rounded-full bg-accent"><WalletCards size={23} /></span></div>
            <p className="mt-6 text-xs text-black/45">Testnet NIM has no monetary value. Mainnet payouts are not enabled.</p>
          </section>

          <div className="mt-10 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Payout activity</h2><span className="text-sm text-white/40">{payouts.length} total</span></div>
          {payouts.length ? <div className="mt-4 space-y-3">{payouts.map((payout) => <PayoutCard key={payout.id} payout={payout} />)}</div> : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.06]"><Clock3 size={22} className="text-white/55" /></span><h3 className="mt-4 font-display text-xl font-bold">No payouts yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">When you win a funded quest, its reward allocation and payout status will appear here.</p><Link href="/discover" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-dark">Explore quests</Link></div>
          )}
        </div>
      </div>
    </main>
  );
}

function PayoutCard({ payout }: { payout: PayoutSummary }) {
  const confirmed = payout.status === "CONFIRMED";
  return <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-5"><div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${confirmed ? "bg-accent text-dark" : "bg-white/[0.07] text-white/65"}`}>{confirmed ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display font-bold">{payout.quest_title}</h3><p className="mt-1 text-xs text-white/40">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(payout.created_at))}</p></div><strong className="text-lg text-accent">+{payout.amount_nim} NIM</strong></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-white/10 px-2.5 py-1 font-semibold">{payout.status.toLowerCase()}</span><span className="text-white/40">To {shortAddress(payout.destination_address)}</span>{payout.transaction_hash ? <span className="ml-auto font-mono text-white/35" title={payout.transaction_hash}>Tx {payout.transaction_hash.slice(0, 10)}…</span> : null}</div>{payout.failure_reason ? <p className="mt-3 text-xs text-[#ffb4a6]">{payout.failure_reason}</p> : null}</div></div></article>;
}

function formatLuna(luna: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 5 }).format(luna / 100_000);
}

function shortAddress(address: string) {
  return `${address.slice(0, 9)}…${address.slice(-9)}`;
}
