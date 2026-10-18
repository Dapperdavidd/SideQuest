"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { apiUrl, readApiError, type CreatorAnalytics, type Organization } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function BusinessProfilePanel({ initialOrganization, analytics }: { initialOrganization: Organization | null; analytics: CreatorAnalytics | null }) {
  const [organization, setOrganization] = useState(initialOrganization);
  const [editing, setEditing] = useState(!initialOrganization);
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

  return (
    <section className="px-5 pb-8 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Business profile</h2><p className="mt-1 text-sm text-white/45">Use the same SideQuest account to represent a café, venue, brand, or community.</p></div>{organization && !editing ? <button onClick={() => setEditing(true)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold">Edit profile</button> : null}</div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {organization && !editing ? <div><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-dark"><Building2 size={21} /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg font-bold">{organization.display_name}</h3><StatusBadge status={organization.verification_status} /></div><p className="text-sm text-white/40">sidequest.app/businesses/{organization.slug}</p></div></div>{organization.description ? <p className="mt-4 text-sm leading-6 text-white/60">{organization.description}</p> : null}{organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">Visit website</a> : null}<p className="mt-4 rounded-xl bg-white/[0.04] p-4 text-xs leading-5 text-white/50">{organization.verification_status === "VERIFIED" ? "This profile is publicly visible and ready to sponsor quests." : organization.verification_status === "REJECTED" ? "Verification was not approved. Update the business details to submit it for review again." : "This profile is private while verification is pending. You can keep using SideQuest normally."}{organization.verification_reason ? <><br /><strong className="mt-2 block text-white/70">Decision note: {organization.verification_reason}</strong></> : null}</p>{analytics ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[[analytics.active_quests, "Active"], [analytics.entries_received, "Entries"], [analytics.valid_submissions, "Valid"], [analytics.winners_selected, "Winners"], [`${(analytics.rewards_paid_minor / 100000).toLocaleString(undefined, { maximumFractionDigits: 5 })} NIM`, "Paid"]].map(([value, label]) => <div key={label} className="rounded-xl bg-white/[0.04] p-3"><strong className="block text-sm text-accent">{value}</strong><span className="text-[.65rem] text-white/40">{label}</span></div>)}</div> : null}{organization.verification_status === "VERIFIED" ? <Link href={`/businesses/${organization.slug}`} className="mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-bold text-dark">View public profile</Link> : null}</div> : <div className="space-y-4"><label className="block text-sm font-bold">Business name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-normal text-white outline-none focus:border-accent" placeholder="Brew & Co." /></label><label className="block text-sm font-bold">Profile address<span className="mt-2 flex items-center rounded-xl border border-white/10 bg-black/20 px-4"><span className="text-xs text-white/30">/businesses/</span><input value={slug} onChange={(event) => updateSlug(event.target.value)} maxLength={40} className="min-w-0 flex-1 bg-transparent py-3 font-normal text-white outline-none" placeholder="brew-and-co" /></span></label><label className="block text-sm font-bold">About the business<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-normal text-white outline-none focus:border-accent" placeholder="Tell explorers what makes this place or community special." /></label><label className="block text-sm font-bold">Website <span className="font-normal text-white/40">(optional)</span><input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} maxLength={2048} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-normal text-white outline-none focus:border-accent" placeholder="https://example.com" /></label>{error ? <p role="alert" className="rounded-xl bg-[#4a211b] p-3 text-sm text-[#ffb8aa]">{error}</p> : null}<div className="flex flex-wrap gap-3"><button onClick={save} disabled={working || displayName.trim().length < 2 || slug.trim().length < 3 || (description.length > 0 && description.trim().length < 3)} className="flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-dark disabled:opacity-40">{working ? <LoaderCircle size={17} className="animate-spin" /> : <Building2 size={17} />}{organization ? "Save changes" : "Create business profile"}</button>{organization ? <button onClick={() => setEditing(false)} className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold">Cancel</button> : null}</div><p className="text-xs leading-5 text-white/40">Saving changes submits the profile for review. Editing a verified profile temporarily removes its verified status until the new details are approved.</p></div>}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Organization["verification_status"] }) {
  const verified = status === "VERIFIED";
  return <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${verified ? "bg-accent text-dark" : "bg-white/10 text-white/60"}`}>{verified ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}{status.toLowerCase()}</span>;
}
