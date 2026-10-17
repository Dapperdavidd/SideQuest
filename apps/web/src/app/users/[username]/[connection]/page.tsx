import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { getFollowers, getFollowing, getPublicProfile } from "@/lib/api/quests";

type ConnectionPageProps = { params: Promise<{ username: string; connection: string }> };

export default function ConnectionPage(props: ConnectionPageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-[#101310]" />}><ConnectionContent {...props} /></Suspense>;
}

async function ConnectionContent({ params }: ConnectionPageProps) {
  const { username, connection } = await params;
  if (connection !== "followers" && connection !== "following") notFound();
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const profiles = connection === "followers" ? await getFollowers(profile.id) : await getFollowing(profile.id);
  const title = connection === "followers" ? "Followers" : "Following";

  return <main className="min-h-screen bg-[#101310] p-3 text-white sm:p-5"><div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#151815]"><header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8"><Link href={`/users/${profile.username}`} className="flex items-center gap-2 text-sm text-white/65"><ArrowLeft size={18} />Profile</Link><Logo inverse /><span className="w-16" /></header><section className="px-5 py-8 sm:px-8"><p className="text-sm text-accent">@{profile.username}</p><h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em]">{title}</h1><p className="mt-2 text-sm text-white/45">{profiles.length} {profiles.length === 1 ? "person" : "people"}</p><div className="mt-7 space-y-3">{profiles.map((person) => <Link key={person.id} href={`/users/${person.username}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-accent/40 hover:bg-white/[0.06]">{person.avatar_url ? <Image src={person.avatar_url} alt="" width={52} height={52} unoptimized className="h-13 w-13 rounded-full object-cover" /> : <div className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-accent/15 font-bold text-accent">{person.display_name.trim().charAt(0).toUpperCase() || "S"}</div>}<div className="min-w-0 flex-1"><strong className="block truncate">{person.display_name}</strong><span className="block truncate text-sm text-white/45">@{person.username}</span>{person.bio ? <p className="mt-1 line-clamp-1 text-xs text-white/55">{person.bio}</p> : null}</div><span className="text-xs text-white/35">{person.followers_count} followers</span></Link>)}{profiles.length === 0 ? <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/10 text-center"><div><UsersRound className="mx-auto text-white/25" size={34} /><h2 className="mt-4 font-display text-lg font-bold">No {title.toLowerCase()} yet</h2><p className="mt-1 text-sm text-white/40">Connections will appear here as the community grows.</p></div></div> : null}</div></section></div></main>;
}
