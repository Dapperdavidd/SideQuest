"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CheckCircle2, LoaderCircle } from "lucide-react";
import { apiUrl, readApiError, type CreatorAnalytics, type Organization } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function BusinessProfilePanel({ initialOrganization, analytics }: { initialOrganization: Organization | null; analytics: CreatorAnalytics | null }) {
  const [organization, setOrganization] = useState(initialOrganization);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialOrganization?.display_name ?? "");
  const [slug, setSlug] = useState(initialOrganization?.slug ?? "");
  const [description, setDescription] = useState(initialOrganization?.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialOrganization?.website_url ?? "");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSlug(value: string) {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-/, "").slice(0, 40));
  }

  async function save() {
    setWorking(true);
    setError(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) throw new Error("Sign in again to save your business profile.");
      const response = await fetch(apiUrl(organization ? `/organizations/${organization.id}` : "/organizations"), {
        method: organization ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          display_name: displayName.trim(),
          description: description.trim() || null,
          website_url: websiteUrl.trim() || null,
          logo_url: organization?.logo_url ?? null,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "The business profile could not be saved."));
      const saved = await response.json() as Organization;
      setOrganization(saved);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The business profile could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  if (!organization && !editing) {
    return <button type="button" onClick={() => setEditing(true)} className="sq-btn sq-btn-inv">Create organization</button>;
  }

  return (
    <section className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl font-black uppercase">Organization</h2><p className="mt-1 text-sm text-ink-2">Post bounties as a café, venue, brand or community from this account. The Organization badge is free.</p></div>{organization && !editing ? <button onClick={() => setEditing(true)} className="rounded-full border border-line px-4 py-2 text-xs font-bold">Edit profile</button> : null}</div>
      <div className="mt-4 rounded-2xl border border-line bg-sunken p-5">
        {organization && !editing ? <div><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime text-on-lime"><Building2 size={21} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg font-black uppercase">{organization.display_name}</h3><StatusBadge status={organization.verification_status} /></div><p className="text-sm text-ink-2">sidequest.app/businesses/{organization.slug}</p></div></div>{organization.description ? <p className="mt-4 text-sm leading-6 text-ink-2">{organization.description}</p> : null}{organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-ink hover:underline">Visit website</a> : null}<p className="mt-4 rounded-xl bg-sunken p-4 text-xs leading-5 text-ink-2">{organization.verification_status === "VERIFIED" ? "Verified. The seal shows on every bounty you post, with priority on Discover and Radar." : "Your Organization badge is live on every bounty you post. Verified is a paid upgrade once you qualify: 10 bounties published, 5 completed and paid out, an account 30 days old and a confirmed website or social handle."}{organization.verification_reason ? <><br /><strong className="mt-2 block text-ink-2">Decision note: {organization.verification_reason}</strong></> : null}</p>{analytics ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[[analytics.active_quests, "Active"], [analytics.entries_received, "Entries"], [analytics.valid_submissions, "Valid"], [analytics.winners_selected, "Winners"], [`${(analytics.rewards_paid_minor / 100000).toLocaleString(undefined, { maximumFractionDigits: 5 })} NIM`, "Paid"]].map(([value, label]) => <div key={label} className="rounded-xl bg-sunken p-3"><strong className="block text-sm text-ink">{value}</strong><span className="text-[.65rem] text-ink-2">{label}</span></div>)}</div> : null}<Link href={`/businesses/${organization.slug}`} className="mt-4 inline-flex rounded-full bg-lime px-4 py-2 text-sm font-bold text-on-lime">View organization page</Link></div> : <div className="space-y-4"><label className="block text-sm font-bold">Business name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-line bg-sunken px-4 py-3 font-normal text-ink outline-none focus:border-inv" placeholder="Brew & Co." /></label><label className="block text-sm font-bold">Profile address<span className="mt-2 flex items-center rounded-xl border border-line bg-sunken px-4"><span className="text-xs text-ink-2">/businesses/</span><input value={slug} onChange={(event) => updateSlug(event.target.value)} maxLength={40} className="min-w-0 flex-1 bg-transparent py-3 font-normal text-ink outline-none" placeholder="brew-and-co" /></span></label><label className="block text-sm font-bold">About the business<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-line bg-sunken px-4 py-3 font-normal text-ink outline-none focus:border-inv" placeholder="Tell explorers what makes this place or community special." /></label><label className="block text-sm font-bold">Website <span className="font-normal text-ink-2">(optional)</span><input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} maxLength={2048} className="mt-2 w-full rounded-xl border border-line bg-sunken px-4 py-3 font-normal text-ink outline-none focus:border-inv" placeholder="https://example.com" /></label>{error ? <p role="alert" className="rounded-xl border border-danger/30 p-3 text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap gap-3"><button onClick={save} disabled={working || displayName.trim().length < 2 || slug.trim().length < 3 || (description.length > 0 && description.trim().length < 3)} className="flex items-center gap-2 rounded-full bg-lime px-5 py-3 text-sm font-bold text-ink disabled:opacity-40">{working ? <LoaderCircle size={17} className="animate-spin" /> : <Building2 size={17} />}{organization ? "Save changes" : "Create organization"}</button><button onClick={() => setEditing(false)} className="rounded-full border border-line px-5 py-3 text-sm font-bold">Cancel</button></div><p className="text-xs leading-5 text-ink-2">Free. The Organization badge shows as soon as you save. Editing a Verified organization sends it back for a quick identity check.</p></div>}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Organization["verification_status"] }) {
  const verified = status === "VERIFIED";
  return <span className="flex gap-1.5"><span className="sq-pill bg-sunken text-ink"><Building2 size={12} aria-hidden="true" />Organization</span>{verified ? <span className="sq-pill bg-lime text-on-lime"><CheckCircle2 size={12} aria-hidden="true" />Verified</span> : null}</span>;
}
