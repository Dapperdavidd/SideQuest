import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Award, Compass, LogOut, Sparkles, Trophy, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AchievementGrid } from "@/components/achievement-grid";
import { getAchievements, getCreatorAnalytics, getMyOrganization, getOrganizationAnalytics, getPublicProfile } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { signOut } from "./actions";
import { PayoutDestinationForm } from "./payout-destination-form";
import { createClient } from "@/lib/supabase/server";
import { BusinessProfilePanel } from "./business-profile-panel";
import { ProfileEditor } from "./profile-editor";

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth");
  const [stats, achievements, analytics, organization] = await Promise.all([
    getPublicProfile(viewer.username).catch(() => null),
    getAchievements(viewer.username).catch(() => []),
    getCreatorAnalytics(session.access_token).catch(() => null),
    getMyOrganization(session.access_token).catch(() => null),
  ]);

  const firstName = viewer.displayName.split(/\s+/)[0] || "Explorer";
  const businessAnalytics = organization ? await getOrganizationAnalytics(organization.id, session.access_token).catch(() => null) : null;
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <AppShell active="profile" viewer={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl }}>
      <div className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9"><div className="mx-auto max-w-5xl overflow-hidden rounded-[1.7rem] bg-[#151815] text-white shadow-[0_25px_70px_rgba(17,19,16,.16)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8"><div><p className="app-eyebrow !text-accent">Your SideQuest story</p></div><form action={signOut}><button className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"><LogOut size={16} />Sign out</button></form></div>

        <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(199,255,0,0.16),transparent_35%)] px-5 py-12 sm:px-10 sm:py-16">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
            {viewer.avatarUrl ? (
              <Image src={viewer.avatarUrl} alt="" width={112} height={112} className="h-28 w-28 rounded-full border-4 border-accent object-cover" unoptimized />
            ) : (
              <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-accent bg-dark text-4xl font-bold text-accent">{initial}</div>
            )}
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-accent"><Sparkles size={15} />SideQuest explorer</p>
              <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em]">{viewer.displayName}</h1>
              <p className="mt-1 text-sm text-white/45">@{viewer.username}</p>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">{viewer.bio ?? `${firstName} is turning everyday moments into small adventures.`}</p>
              <ProfileEditor profile={viewer} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 px-5 py-8 sm:grid-cols-3 sm:px-10">
          {[{ icon: Trophy, value: stats?.completed_quests_count ?? 0, label: "Completed" }, { icon: Compass, value: stats?.created_quests_count ?? 0, label: "Created" }, { icon: Award, value: stats?.wins_count ?? 0, label: "Wins" }].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Icon size={19} className="text-accent" /><strong className="mt-5 block text-3xl">{value}</strong><span className="mt-1 block text-sm text-white/45">{label}</span></div>
          ))}
        </section>

        <section className="px-5 pb-8 sm:px-10">
          <h2 className="font-display text-xl font-bold">Achievements</h2>
          <p className="mt-1 text-sm text-white/45">Unlocked only by official SideQuest activity.</p>
          <div className="mt-4"><AchievementGrid achievements={achievements} dark /></div>
        </section>

        <section className="px-5 pb-8 sm:px-10">
          <h2 className="font-display text-xl font-bold">Creator overview</h2>
          <p className="mt-1 text-sm text-white/45">Calculated from official quest, review, winner, and payout records.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              [analytics?.active_quests ?? 0, "Active quests"],
              [analytics?.entries_received ?? 0, "Entries"],
              [analytics?.valid_submissions ?? 0, "Valid"],
              [analytics?.winners_selected ?? 0, "Winners"],
              [`${((analytics?.rewards_paid_minor ?? 0) / 100000).toLocaleString(undefined, { maximumFractionDigits: 5 })} NIM`, "Paid"],
            ].map(([value, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><strong className="block text-xl text-accent">{value}</strong><span className="mt-1 block text-xs text-white/45">{label}</span></div>)}
          </div>
        </section>

        <BusinessProfilePanel initialOrganization={organization} analytics={businessAnalytics} />

        <section className="px-5 pb-10 sm:px-10">
          <h2 className="font-display text-xl font-bold">Account</h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <span className="text-xs uppercase tracking-[0.16em] text-white/35">Signed in with</span>
            <p className="mt-1 text-sm text-white/75">{viewer.email ?? "Google account"}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-dark"><WalletCards size={19} /></span><div><h3 className="font-display font-bold">NIM reward destination</h3><p className="mt-1 text-sm leading-6 text-white/50">Required before entering a rewarded quest. The address is locked with each official submission.</p></div></div>
            <PayoutDestinationForm />
            <Link href="/wallet" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"><WalletCards size={16} />View reward payouts</Link>
          </div>
        </section>
      </div></div>
    </AppShell>
  );
}

function ProfileSkeleton() {
  return <main className="min-h-screen animate-pulse bg-[#101310] p-5"><div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-5xl rounded-[1.5rem] bg-[#151815]" /></main>;
}
