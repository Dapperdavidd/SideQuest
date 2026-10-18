"use client";

import { useState } from "react";
import { Ban, Building2, Check, ExternalLink, Flag, LoaderCircle, RotateCcw, ShieldAlert, UserX, WalletCards, X } from "lucide-react";
import { type AdminOrganization, type AdminReport, type FailedPayout, type SuspendedQuest, type SuspendedUser, changeQuestSuspension, changeUserSuspension, decideOrganization, decideReport, retryFailedPayout } from "@/lib/api/admin";

export function OperationsConsole({ initialReports, initialOrganizations, initialFailedPayouts, initialSuspendedQuests, initialSuspendedUsers, accessToken }: { initialReports: AdminReport[]; initialOrganizations: AdminOrganization[]; initialFailedPayouts: FailedPayout[]; initialSuspendedQuests: SuspendedQuest[]; initialSuspendedUsers: SuspendedUser[]; accessToken: string }) {
  const [reports, setReports] = useState(initialReports);
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [failedPayouts, setFailedPayouts] = useState(initialFailedPayouts);
  const [suspendedQuests, setSuspendedQuests] = useState(initialSuspendedQuests);
  const [suspendedUsers, setSuspendedUsers] = useState(initialSuspendedUsers);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reportDecision(report: AdminReport, status: "REVIEWING" | "RESOLVED" | "DISMISSED") {
    const note = notes[report.id]?.trim() || null;
    if (status !== "REVIEWING" && (!note || note.length < 3)) {
      setError("Add a short decision note before resolving or dismissing a report.");
      return;
    }
    setWorking(report.id);
    setError(null);
    try {
      await decideReport(report.id, status, note, accessToken);
      if (status === "REVIEWING") setReports((items) => items.map((item) => item.id === report.id ? { ...item, status } : item));
      else setReports((items) => items.filter((item) => item.id !== report.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be saved.");
    } finally {
      setWorking(null);
    }
  }

  async function organizationDecision(organization: AdminOrganization, status: "VERIFIED" | "REJECTED") {
    const reason = notes[organization.id]?.trim() || null;
    if (status === "REJECTED" && (!reason || reason.length < 3)) {
      setError("Add a clear reason before rejecting a business profile.");
      return;
    }
    setWorking(organization.id);
    setError(null);
    try {
      await decideOrganization(organization.id, status, reason, accessToken);
      setOrganizations((items) => items.filter((item) => item.id !== organization.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be saved.");
    } finally {
      setWorking(null);
    }
  }

  async function retryPayout(payout: FailedPayout) {
    setWorking(payout.id);
    setError(null);
    try {
      await retryFailedPayout(payout.id, accessToken);
      setFailedPayouts((items) => items.filter((item) => item.id !== payout.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payout could not be safely retried.");
    } finally {
      setWorking(null);
    }
  }

  async function suspendReportedQuest(report: AdminReport) {
    const reason = notes[report.id]?.trim();
    if (!report.quest_id || !reason || reason.length < 3) return setError("Add a clear enforcement note before suspending this quest.");
    setWorking(report.id);
    setError(null);
    try {
      await changeQuestSuspension(report.quest_id, "suspend", reason, accessToken);
      setSuspendedQuests((items) => [{ suspension_id: report.id, quest_id: report.quest_id!, title: report.quest_title ?? "Quest", creator_username: "", creator_display_name: "", previous_status: "ACTIVE", reason, suspended_at: new Date().toISOString() }, ...items]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The quest could not be suspended.");
    } finally {
      setWorking(null);
    }
  }

  async function reinstateQuest(quest: SuspendedQuest) {
    const reason = notes[quest.suspension_id]?.trim();
    if (!reason || reason.length < 3) return setError("Add a reinstatement note before restoring this quest.");
    setWorking(quest.suspension_id);
    setError(null);
    try {
      await changeQuestSuspension(quest.quest_id, "reinstate", reason, accessToken);
      setSuspendedQuests((items) => items.filter((item) => item.quest_id !== quest.quest_id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The quest could not be reinstated.");
    } finally {
      setWorking(null);
    }
  }

  async function suspendReportedUser(report: AdminReport) {
    const reason = notes[report.id]?.trim();
    if (!report.user_id || !reason || reason.length < 3) return setError("Add a clear enforcement note before suspending this account.");
    setWorking(report.id);
    setError(null);
    try {
      await changeUserSuspension(report.user_id, "suspend", reason, accessToken);
      setSuspendedUsers((items) => [{ suspension_id: report.id, user_id: report.user_id!, username: report.user_username ?? "", display_name: report.user_display_name ?? "Account", reason, suspended_at: new Date().toISOString() }, ...items]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The account could not be suspended.");
    } finally {
      setWorking(null);
    }
  }

  async function reinstateUser(account: SuspendedUser) {
    const reason = notes[account.suspension_id]?.trim();
    if (!reason || reason.length < 3) return setError("Add a reinstatement note before restoring this account.");
    setWorking(account.suspension_id);
    setError(null);
    try {
      await changeUserSuspension(account.user_id, "reinstate", reason, accessToken);
      setSuspendedUsers((items) => items.filter((item) => item.user_id !== account.user_id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The account could not be reinstated.");
    } finally {
      setWorking(null);
    }
  }

  return <>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Trust & safety</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Operations console</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Review reports, enforce account and quest safety, verify business identities, and recover independently failed payouts. Every action is authorized again by the API and audited.</p></div><div className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50">{reports.length + organizations.length + failedPayouts.length + suspendedQuests.length + suspendedUsers.length} awaiting action</div></div>
    {error ? <p role="alert" className="mt-6 rounded-2xl border border-[#ff8a70]/30 bg-[#ff8a70]/10 p-4 text-sm text-[#ffb2a1]">{error}</p> : null}
    <section className="mt-9"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-dark"><Flag size={18} /></span><div><h2 className="font-display text-2xl font-bold">Content reports</h2><p className="text-sm text-white/45">Open and actively reviewing</p></div></div><div className="mt-5 space-y-4">{reports.length ? reports.map((report) => <article key={report.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold ${report.status === "REVIEWING" ? "bg-[#ffe9a8] text-[#5a4300]" : "bg-white/10 text-white/65"}`}>{report.status.replaceAll("_", " ")}</span><h3 className="mt-3 font-display text-lg font-bold">{report.subject_type === "QUEST" ? report.quest_title ?? "Quest" : report.user_display_name ?? "User"}</h3><p className="mt-1 text-xs text-white/40">{report.reason.replaceAll("_", " ")} · reported by @{report.reporter_username} · {new Date(report.created_at).toLocaleString()}</p></div><ShieldAlert size={20} className="text-[#ff9b83]" /></div>{report.details ? <p className="mt-4 rounded-xl bg-black/20 p-4 text-sm leading-6 text-white/65">{report.details}</p> : null}<textarea value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Decision or enforcement note…" className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent" /><div className="mt-3 flex flex-wrap gap-2">{report.status === "OPEN" ? <ActionButton label="Start review" icon={ShieldAlert} busy={working === report.id} onClick={() => reportDecision(report, "REVIEWING")} /> : null}{report.quest_id ? <ActionButton label="Suspend quest" icon={Ban} busy={working === report.id} onClick={() => suspendReportedQuest(report)} muted /> : null}<ActionButton label="Resolve" icon={Check} busy={working === report.id} onClick={() => reportDecision(report, "RESOLVED")} /><ActionButton label="Dismiss" icon={X} busy={working === report.id} onClick={() => reportDecision(report, "DISMISSED")} muted /></div></article>) : <EmptyState text="No open content reports." />}</div></section>
    <section className="mt-12"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff9b83] text-dark"><Ban size={18} /></span><div><h2 className="font-display text-2xl font-bold">Suspended quests</h2><p className="text-sm text-white/45">Hidden from discovery and blocked from new entries</p></div></div><div className="mt-5 space-y-4">{suspendedQuests.length ? suspendedQuests.map((quest) => <article key={quest.quest_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h3 className="font-display text-lg font-bold">{quest.title}</h3><p className="mt-1 text-xs text-white/40">Previously {quest.previous_status.replaceAll("_", " ").toLowerCase()} · suspended {new Date(quest.suspended_at).toLocaleString()}</p><p className="mt-4 rounded-xl bg-black/20 p-3 text-sm text-white/60">{quest.reason}</p><textarea value={notes[quest.suspension_id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [quest.suspension_id]: event.target.value }))} maxLength={500} rows={2} placeholder="Reinstatement note…" className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent" /><div className="mt-3"><ActionButton label="Reinstate quest" icon={RotateCcw} busy={working === quest.suspension_id} onClick={() => reinstateQuest(quest)} /></div></article>) : <EmptyState text="No quests are currently suspended." />}</div></section>
    <section className="mt-12"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-dark"><Building2 size={18} /></span><div><h2 className="font-display text-2xl font-bold">Business verification</h2><p className="text-sm text-white/45">Pending identity reviews</p></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{organizations.length ? organizations.map((organization) => <article key={organization.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">@{organization.owner_username}</p><h3 className="mt-2 font-display text-xl font-bold">{organization.display_name}</h3><p className="mt-1 text-xs text-white/40">sidequest.app/businesses/{organization.slug} · submitted {new Date(organization.created_at).toLocaleDateString()}</p>{organization.description ? <p className="mt-4 text-sm leading-6 text-white/60">{organization.description}</p> : null}{organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">Inspect website <ExternalLink size={14} /></a> : null}<textarea value={notes[organization.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [organization.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Verification note or rejection reason…" className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent" /><div className="mt-3 flex flex-wrap gap-2"><ActionButton label="Verify business" icon={Check} busy={working === organization.id} onClick={() => organizationDecision(organization, "VERIFIED")} /><ActionButton label="Reject" icon={X} busy={working === organization.id} onClick={() => organizationDecision(organization, "REJECTED")} muted /></div></article>) : <EmptyState text="No business profiles are awaiting verification." />}</div></section>
    <section className="mt-12"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-dark"><WalletCards size={18} /></span><div><h2 className="font-display text-2xl font-bold">Failed reward payouts</h2><p className="text-sm text-white/45">Retry only after independent chain verification</p></div></div><div className="mt-5 space-y-4">{failedPayouts.length ? failedPayouts.map((payout) => <article key={payout.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ff9b83]">{payout.payout_kind === "CREATOR_REFUND" ? "Creator refund" : "Winner reward"} · attempt {payout.current_attempt} failed</p><h3 className="mt-2 font-display text-lg font-bold">{payout.amount_nim} NIM · {payout.quest_title}</h3><p className="mt-1 text-xs text-white/40">For {payout.recipient_display_name} (@{payout.recipient_username})</p></div><ActionButton label="Verify & retry" icon={RotateCcw} busy={working === payout.id} onClick={() => retryPayout(payout)} /></div><p className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-white/55">{payout.failure_reason ?? "The submitted transaction failed independent verification."}</p><p className="mt-3 break-all text-[0.65rem] text-white/30">Tx {payout.transaction_hash}</p></article>) : <EmptyState text="No failed reward payouts require attention." />}</div></section>
    <section className="mt-12"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff9b83] text-dark"><UserX size={18} /></span><div><h2 className="font-display text-2xl font-bold">Account enforcement</h2><p className="text-sm text-white/45">Reported accounts and active suspensions</p></div></div><div className="mt-5 space-y-4">{reports.filter((report) => report.user_id).map((report) => <article key={`account-${report.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h3 className="font-display font-bold">{report.user_display_name ?? "Reported account"} <span className="font-normal text-white/40">@{report.user_username}</span></h3><p className="mt-2 text-sm text-white/55">Use the decision note on this account’s report as the enforcement reason.</p><div className="mt-3"><ActionButton label="Suspend account" icon={UserX} busy={working === report.id} onClick={() => suspendReportedUser(report)} muted /></div></article>)}{suspendedUsers.map((account) => <article key={account.user_id} className="rounded-2xl border border-[#ff9b83]/30 bg-[#ff9b83]/5 p-5"><h3 className="font-display font-bold">{account.display_name} <span className="font-normal text-white/40">@{account.username}</span></h3><p className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-white/60">{account.reason}</p><textarea value={notes[account.suspension_id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [account.suspension_id]: event.target.value }))} maxLength={500} rows={2} placeholder="Reinstatement note…" className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-accent" /><div className="mt-3"><ActionButton label="Reinstate account" icon={RotateCcw} busy={working === account.suspension_id} onClick={() => reinstateUser(account)} /></div></article>)}{!reports.some((report) => report.user_id) && !suspendedUsers.length ? <EmptyState text="No accounts require enforcement action." /> : null}</div></section>
  </>;
}

function ActionButton({ label, icon: Icon, busy, onClick, muted = false }: { label: string; icon: typeof Check; busy: boolean; onClick: () => void; muted?: boolean }) {
  return <button type="button" disabled={busy} onClick={onClick} className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50 ${muted ? "border border-white/10 text-white/65 hover:bg-white/5" : "bg-accent text-dark"}`}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Icon size={14} />}{label}</button>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">{text}</div>;
}
