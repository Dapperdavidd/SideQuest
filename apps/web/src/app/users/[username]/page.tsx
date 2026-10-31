import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AchievementGrid } from "@/components/achievement-grid";
import { getAchievements, getBlockState, getFollowState, getPublicProfile } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { FollowButton } from "./follow-button";
import { ReportContentButton } from "@/components/report-content-button";

type PublicProfilePageProps = { params: Promise<{ username: string }> };

export default function PublicProfilePage(props: PublicProfilePageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-[#101310]" />}><PublicProfileContent {...props} /></Suspense>;
}

async function PublicProfileContent({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const profilePromise = getPublicProfile(username);
  const achievementsPromise = getAchievements(username);
  const viewerPromise = getViewer();
  const supabase = await createClient();
  const sessionPromise = supabase.auth.getSession();
  const [profile, achievements, viewer, { data: { session } }] = await Promise.all([profilePromise, achievementsPromise, viewerPromise, sessionPromise]);
  if (!profile) notFound();
  const ownProfile = viewer?.id === profile.id;
  const blocked = session && !ownProfile ? await getBlockState(profile.id, session.access_token) : false;
  const following = session && !ownProfile && !blocked ? await getFollowState(profile.id, session.access_token) : false;
  const initial = profile.display_name.trim().charAt(0).toUpperCase() || "S";

  const stats = [
    { value: profile.followers_count, label: "Followers", href: `/users/${profile.username}/followers` },
    { value: profile.following_count, label: "Following", href: `/users/${profile.username}/following` },
    { value: profile.created_quests_count, label: "Created" },
    { value: profile.completed_quests_count, label: "Completed" },
    { value: profile.wins_count, label: "Wins" },
  ];

  return <AppShell active="discover" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl } : null}><div className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9"><div className="mx-auto max-w-5xl overflow-hidden rounded-[1.7rem] bg-[#151815] text-white shadow-[0_25px_70px_rgba(17,19,16,.16)]"><section className="bg-[radial-gradient(circle_at_top_right,rgba(199,255,0,0.16),transparent_38%)] px-5 py-12 sm:px-10 sm:py-16"><div className="flex flex-col gap-7 sm:flex-row sm:items-center">{profile.avatar_url ? <Image src={profile.avatar_url} alt="" width={112} height={112} unoptimized className="h-28 w-28 rounded-full border-4 border-accent object-cover" /> : <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-accent bg-dark text-4xl font-bold text-accent">{initial}</div>}<div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-semibold text-accent"><Sparkles size={15} />SideQuest explorer</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em]">{profile.display_name}</h1><p className="mt-1 text-sm text-white/45">@{profile.username}</p><p className="mt-4 max-w-xl text-sm leading-6 text-white/60">{profile.bio ?? "Turning everyday moments into small adventures."}</p></div>{ownProfile ? <Link href="/profile" className="rounded-full bg-accent px-5 py-3 text-sm font-bold text-dark">Manage profile</Link> : <FollowButton userId={profile.id} username={profile.username} initialFollowing={following} />}</div>{!ownProfile ? <div className="mt-5"><ReportContentButton subjectType="USER" targetId={profile.id} returnPath={`/users/${profile.username}`} /></div> : null}</section><section className="grid grid-cols-2 gap-3 border-t border-white/10 px-5 py-8 sm:grid-cols-5 sm:px-10">{stats.map(({ value, label, href }) => { const card = <><strong className="block text-2xl text-accent">{value}</strong><span className="mt-1 block text-xs text-white/45">{label}</span></>; return href ? <Link key={label} href={href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-accent/40 hover:bg-white/[0.06]">{card}</Link> : <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">{card}</div>; })}</section><section className="px-5 pb-8 sm:px-10"><h2 className="font-display text-xl font-bold">Achievements</h2><p className="mt-1 text-sm text-white/45">Progress is calculated from official activity.</p><div className="mt-4"><AchievementGrid achievements={achievements} dark /></div></section><section className="px-5 pb-10 sm:px-10"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><Trophy size={21} className="text-accent" /><h2 className="mt-4 font-display text-xl font-bold">Quest record</h2><p className="mt-2 text-sm leading-6 text-white/50">Only finalized participation and official winner records contribute to this profile.</p></div></section></div></div></AppShell>;
}
