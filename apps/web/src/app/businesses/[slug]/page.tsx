import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CheckCircle2, ExternalLink } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { getOrganization } from "@/lib/api/quests";

export default async function BusinessProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><BusinessProfile params={params} /></Suspense>;
}

async function BusinessProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getOrganization(slug);
  if (!organization || organization.verification_status !== "VERIFIED") notFound();

  return <main className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8"><Logo /><Link href="/discover" className="rounded-full border border-line px-4 py-2 text-sm font-bold">Discover quests</Link></header><div className="mx-auto max-w-4xl px-5 py-10 sm:py-16"><section className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-[0_24px_70px_rgba(23,25,23,.08)]"><div className="h-36 bg-[radial-gradient(circle_at_78%_30%,rgba(199,255,0,.7),transparent_22%),linear-gradient(135deg,#20251f,#0f110f)]" /><div className="px-6 pb-8 sm:px-10"><span className="-mt-12 grid h-24 w-24 place-items-center rounded-3xl border-4 border-white bg-accent text-dark shadow-lg"><Building2 size={38} /></span><div className="mt-5 flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl font-bold tracking-tight">{organization.display_name}</h1><span className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold"><CheckCircle2 size={14} /> Verified business</span></div><p className="mt-2 text-sm text-muted">@{organization.owner_username} · /businesses/{organization.slug}</p>{organization.description ? <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-7 text-muted">{organization.description}</p> : null}<div className="mt-7 flex flex-wrap gap-3">{organization.website_url ? <a href={organization.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-dark px-5 py-3 text-sm font-bold text-white">Visit website <ExternalLink size={15} /></a> : null}<Link href={`/users/${organization.owner_username}`} className="rounded-full border border-line px-5 py-3 text-sm font-bold">View owner profile</Link></div></div></section><p className="mt-6 text-center text-sm text-muted">Verified businesses use the same fair entry limits, review rules, and funded reward safeguards as every SideQuest creator.</p></div></main>;
}
