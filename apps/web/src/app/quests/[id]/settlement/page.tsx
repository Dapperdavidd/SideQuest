import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Clock3, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { Logo } from "@/components/logo";
import { getQuest, getQuestSettlement } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type SettlementPageProps = { params: Promise<{ id: string }> };

export default function SettlementPage(props: SettlementPageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><SettlementExperience {...props} /></Suspense>;
}

async function SettlementExperience({ params }: SettlementPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [quest, viewer] = await Promise.all([getQuest(id, session?.access_token), getViewer()]);
  if (!viewer) redirect(`/auth?next=${encodeURIComponent(`/quests/${id}/settlement`)}`);
  if (!quest || quest.creator_id !== viewer.id) notFound();
  if (!session) redirect(`/auth?next=${encodeURIComponent(`/quests/${id}/settlement`)}`);
  const settlement = await getQuestSettlement(id, session.access_token);
  const confirmed = settlement.payouts.filter((payout) => payout.status === "CONFIRMED").length;

  return <main className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8"><Logo /><Link href={`/quests/${id}/review`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold"><ArrowLeft size={16} />Results</Link></header><div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Creator settlement</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-bold">{quest.title}</h1><p className="mt-2 text-sm text-muted">Follow every winner reward from locked allocation to verified payout.</p></div><span className="rounded-full bg-accent-soft px-4 py-2 text-sm font-bold">Nimiq Testnet</span></div>

  <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Allocated" value={`${settlement.total_allocated_nim} NIM`} icon={<ShieldCheck size={19} />} /><Metric label="Winner payouts" value={`${settlement.payouts.length}`} icon={<Trophy size={19} />} /><Metric label="Confirmed" value={`${confirmed}/${settlement.payouts.length}`} icon={<CheckCircle2 size={19} />} /><Metric label="Unused return" value={settlement.refund ? `${settlement.refund.amount_nim} NIM` : "None"} icon={<RotateCcw size={19} />} /></section>

  <section className="mt-7"><h2 className="font-display text-xl font-bold">Winner payouts</h2>{settlement.payouts.length ? <div className="mt-4 space-y-3">{settlement.payouts.map((payout) => <article key={payout.id} className="rounded-[1.25rem] border border-line bg-white p-5"><div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${payout.status === "CONFIRMED" ? "bg-accent" : "bg-background"}`}>{payout.status === "CONFIRMED" ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-muted">Winner {payout.winner_position}</p><h3 className="mt-1 font-display font-bold">{payout.recipient_display_name}</h3><p className="text-sm text-muted">@{payout.recipient_username}</p></div><strong className="text-lg">{payout.amount_nim} NIM</strong></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-background px-2.5 py-1 font-bold">{payout.status.toLowerCase()}</span><span className="text-muted">{shortAddress(payout.destination_address)}</span>{payout.transaction_hash ? <span className="ml-auto font-mono text-muted" title={payout.transaction_hash}>Tx {payout.transaction_hash.slice(0, 10)}…</span> : null}</div>{payout.failure_reason ? <p className="mt-3 rounded-lg bg-[#fff0ed] p-3 text-xs text-[#8f2e1e]">{payout.failure_reason}</p> : null}</div></div></article>)}</div> : <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white p-10 text-center"><Clock3 className="mx-auto text-muted" /><h3 className="mt-4 font-display text-xl font-bold">No reward allocations yet</h3><p className="mt-2 text-sm text-muted">Payouts appear after a funded quest is finalized with valid winners.</p></div>}</section>
  {settlement.refund ? <section className="mt-7"><h2 className="font-display text-xl font-bold">Unused reward return</h2><article className="mt-4 rounded-[1.25rem] border border-line bg-white p-5"><div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${settlement.refund.status === "CONFIRMED" ? "bg-accent" : "bg-background"}`}>{settlement.refund.status === "CONFIRMED" ? <CheckCircle2 size={20} /> : <RotateCcw size={20} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display font-bold">Returned to the original funding address</h3><p className="mt-1 text-sm text-muted">Created automatically because fewer valid winners were available than the funded winner count.</p></div><strong className="text-lg">{settlement.refund.amount_nim} NIM</strong></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-background px-2.5 py-1 font-bold">{settlement.refund.status.toLowerCase()}</span><span className="text-muted">{shortAddress(settlement.refund.destination_address)}</span>{settlement.refund.transaction_hash ? <span className="ml-auto font-mono text-muted" title={settlement.refund.transaction_hash}>Tx {settlement.refund.transaction_hash.slice(0, 10)}…</span> : null}</div>{settlement.refund.failure_reason ? <p className="mt-3 rounded-lg bg-[#fff0ed] p-3 text-xs text-[#8f2e1e]">{settlement.refund.failure_reason}</p> : null}</div></div></article></section> : null}
  <p className="mt-6 text-xs leading-5 text-muted">This page is read-only. SideQuest will not mark a payout confirmed until the transaction is independently verified on TestAlbatross.</p></div></main>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-[1.25rem] border border-line bg-white p-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft">{icon}</span><strong className="mt-5 block font-display text-2xl">{value}</strong><span className="mt-1 block text-sm text-muted">{label}</span></div>;
}

function shortAddress(address: string) {
  return `${address.slice(0, 9)}…${address.slice(-9)}`;
}
