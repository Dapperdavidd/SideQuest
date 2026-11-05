import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Globe, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AchievementGrid } from "@/components/achievement-grid";
import { Avatar } from "@/components/avatar";
import { FriendButton } from "@/components/friend-button";
import { ReportContentButton } from "@/components/report-content-button";
import { listFriends } from "@/lib/api/friends";
import { getAchievements, getBlockState, getPublicProfile } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type PublicProfilePageProps = { params: Promise<{ username: string }> };

export default function PublicProfilePage(props: PublicProfilePageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><PublicProfileContent {...props} /></Suspense>;
}

async function PublicProfileContent({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();
  const [profile, achievements, viewer, { data: { session } }] = await Promise.all([getPublicProfile(username), getAchievements(username).catch(() => []), getViewer(), supabase.auth.getSession()]);
  if (!profile) notFound();
  const ownProfile = viewer?.id === profile.id;
  const [blocked, friends] = session && !ownProfile ? await Promise.all([getBlockState(profile.id, session.access_token), listFriends(session.access_token)]) : [false, []];
  const relation = friends.find((person) => person.id === profile.id)?.state ?? "NONE";
  const canSeeRecord = ownProfile || profile.profile_visibility === "PUBLIC" || relation === "ACCEPTED";
  const isPrivate = profile.profile_visibility === "PRIVATE";

  const counts = [[profile.completed_quests_count, "Completed"], [profile.created_quests_count, "Created"], [profile.wins_count, "Wins"], [profile.friends_count, "Friends"]] as const;

  return (
    <AppShell active="discover" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username } : null}>
      <div className="px-4 pb-16 pt-8 sm:px-8 lg:px-9 lg:pt-9">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
          <section aria-label="Profile header" className="sq-card flex flex-col gap-6 p-7">
            <div className="flex flex-wrap items-start gap-6">
              <Avatar name={profile.display_name} url={profile.avatar_url} size={104} tilt={-5} tone="coral" />
              <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5"><h1 className="sq-display text-[clamp(36px,4vw,52px)] !leading-none">{profile.display_name}</h1><span className="sq-pill bg-sunken text-ink-2">{isPrivate ? <Lock size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}{isPrivate ? "Private" : "Public"}</span></div>
                <span className="font-mono text-sm font-semibold text-ink-2">@{profile.username}</span>
                <p className="max-w-[560px] text-[15px] leading-snug text-ink-2">{profile.bio ?? "Turning everyday plans into small adventures."}</p>
              </div>
              {ownProfile ? <Link href="/profile" className="sq-btn sq-btn-lime">Manage profile</Link> : blocked ? null : <FriendButton userId={profile.id} username={profile.username} initialState={relation} />}
            </div>
            {canSeeRecord ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{counts.map(([value, label]) => <div key={label} className="flex flex-col gap-1 rounded-[18px] bg-sunken p-4"><span className="font-display text-[34px] font-black leading-none tracking-[-0.04em]">{value}</span><span className="text-xs font-semibold text-ink-2">{label}</span></div>)}</div> : null}
          </section>
          {canSeeRecord ? (
            <section className="sq-card flex flex-col gap-4 p-5"><h2 className="font-display text-[22px] font-black uppercase tracking-[-0.02em]">Trophy shelf</h2><AchievementGrid achievements={achievements} /></section>
          ) : (
            <section className="sq-card flex flex-col items-start gap-3 p-7"><Lock size={22} aria-hidden="true" /><h2 className="sq-display text-[30px]">This profile is private.</h2><p className="text-sm text-ink-2">Only {profile.display_name}&apos;s friends can see their quest record and friends.</p></section>
          )}
          {!ownProfile ? <ReportContentButton subjectType="USER" targetId={profile.id} returnPath={`/users/${profile.username}`} /> : null}
        </div>
      </div>
    </AppShell>
  );
}
