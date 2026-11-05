import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Building2, ChevronRight, Globe, Lock, LogOut, Share2, Trophy, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AchievementGrid } from "@/components/achievement-grid";
import { Avatar } from "@/components/avatar";
import { getAchievements, getCreatorAnalytics, getMyOrganization, getMyQuests, getOrganizationAnalytics, getPublicProfile, getUnreadNotificationCount, questCover, type MyQuestSummary } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { BusinessProfilePanel } from "./business-profile-panel";
import { PayoutDestinationForm } from "./payout-destination-form";
import { PrivacySettings } from "./privacy-settings";
import { ProfileEditor } from "./profile-editor";

export const metadata = { title: "Profile" };

export default function ProfilePage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><ProfileContent /></Suspense>;
}

function recordLabel(quest: MyQuestSummary) {
  if (quest.viewer_is_winner) return { text: "Won", tone: "bg-lime text-on-lime" };
  if (quest.relationship === "CREATOR") return { text: "Created", tone: "bg-inv text-on-inv" };
  if (quest.status === "FINALIZED" && quest.viewer_entry_id) return { text: "Completed", tone: "bg-sunken text-ink" };
  if (quest.viewer_entry_id) return { text: "Entry in", tone: "bg-lime-tint text-ink" };
  return { text: "Joined", tone: "bg-sunken text-ink-2" };
}

async function ProfileContent() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/profile");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth?next=/profile");
  const token = session.access_token;
  const [stats, achievements, analytics, organization, quests, unread] = await Promise.all([
    getPublicProfile(viewer.username).catch(() => null),
    getAchievements(viewer.username).catch(() => []),
    getCreatorAnalytics(token).catch(() => null),
    getMyOrganization(token).catch(() => null),
    getMyQuests(token).catch(() => [] as MyQuestSummary[]),
    getUnreadNotificationCount(token),
  ]);
  const businessAnalytics = organization ? await getOrganizationAnalytics(organization.id, token).catch(() => null) : null;
  const isPrivate = stats?.profile_visibility === "PRIVATE";
  const joined = stats?.created_at ? new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(stats.created_at)) : null;
  const counts = [
    [stats?.completed_quests_count ?? 0, "Completed", null],
    [stats?.created_quests_count ?? 0, "Created", null],
    [stats?.wins_count ?? 0, "Wins", null],
    [stats?.friends_count ?? 0, "Friends", "/friends"],
    [stats?.groups_count ?? 0, "Friend groups", "/friends"],
  ] as const;
  const earned = achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <AppShell active="profile" viewer={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username }} unreadNotifications={unread}>
      <div className="px-4 pb-16 pt-8 sm:px-8 lg:px-9 lg:pt-9">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
          <section aria-label="Profile header" className="sq-card flex flex-col gap-6 p-7">
            <div className="flex flex-wrap items-start gap-6">
              <Avatar name={viewer.displayName} url={viewer.avatarUrl} size={104} tilt={-5} />
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="sq-display text-[clamp(36px,4vw,52px)] !leading-none">{viewer.displayName}</h1>
                  <span className="sq-pill bg-sunken text-ink-2">{isPrivate ? <Lock size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}{isPrivate ? "Private profile" : "Public profile"}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-ink-2">@{viewer.username}</span>
                <p className="max-w-[560px] text-[15px] leading-snug text-ink-2">{viewer.bio ?? "Turning everyday plans into small adventures."}</p>
                {joined ? <span className="text-[13px] text-ink-3">Joined {joined}</span> : null}
                <ProfileEditor profile={viewer} />
              </div>
              <Link href={`/users/${viewer.username}`} className="sq-btn sq-btn-ghost !min-h-11"><Share2 size={16} aria-hidden="true" />View public page</Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {counts.map(([value, label, href]) => {
                const inner = <><span className="font-display text-[34px] font-black leading-none tracking-[-0.04em]">{value}</span><span className="text-xs font-semibold text-ink-2">{label}</span></>;
                return href ? <Link key={label} href={href} className="flex flex-col gap-1 rounded-[18px] border border-line p-4 hover:bg-sunken">{inner}</Link> : <div key={label} className="flex flex-col gap-1 rounded-[18px] bg-sunken p-4">{inner}</div>;
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-start gap-6">
            <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
              <div className="sq-card flex flex-col gap-2 p-5">
                <div className="flex items-baseline justify-between pb-2"><h2 className="font-display text-[22px] font-black uppercase tracking-[-0.02em]">Quest record</h2><Link href="/quests" className="text-sm font-semibold">See all {quests.length}</Link></div>
                {quests.slice(0, 6).map((quest) => {
                  const label = recordLabel(quest);
                  return (
                    <Link key={quest.id} href={`/quests/${quest.id}`} className="flex min-h-16 items-center gap-3.5 rounded-2xl p-2 hover:bg-sunken">
                      <img src={questCover({ id: quest.id, cover_media_url: null, quest_type: quest.quest_type })} alt="" className="h-12 w-12 flex-none rounded-xl object-cover" />
                      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[15px] font-semibold">{quest.title}</span><span className="text-xs text-ink-2">{quest.quest_type === "FRIENDS" ? "Friends" : "Bounty"} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(quest.deadline))}</span></span>
                      <span className={`sq-pill ${label.tone}`}>{label.text === "Won" ? <Trophy size={12} aria-hidden="true" /> : null}{label.text}</span>
                      {quest.reward_enabled && quest.reward_amount_minor ? <span className="hidden font-mono text-sm font-bold sm:inline">{quest.reward_amount_minor / 100_000} NIM</span> : null}
                    </Link>
                  );
                })}
                {!quests.length ? <p className="p-2 text-sm text-ink-2">Your quests show up here once you join or create one.</p> : null}
              </div>
              <div className="sq-card flex flex-col gap-4 p-5">
                <div className="flex items-baseline justify-between"><h2 className="font-display text-[22px] font-black uppercase tracking-[-0.02em]">Trophy shelf</h2><span className="text-sm text-ink-2">{earned} of {achievements.length} earned</span></div>
                <AchievementGrid achievements={achievements} />
              </div>
              {organization ? (
                <section className="sq-card p-5"><BusinessProfilePanel initialOrganization={organization} analytics={businessAnalytics} /></section>
              ) : (
                <section aria-labelledby="org-title" className="sq-card flex flex-wrap items-center gap-4 p-5">
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-lime-tint"><Building2 size={22} aria-hidden="true" /></span>
                  <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1"><span id="org-title" className="text-[17px] font-bold">Run a business or community?</span><span className="text-sm text-ink-2">Create an organization account. It is free and shows the Organization badge on every quest you post.</span></div>
                  <BusinessProfilePanel initialOrganization={null} analytics={null} />
                </section>
              )}
            </section>

            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
              <section className="sq-card flex flex-col gap-3 p-5">
                <h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">Privacy</h2>
                <PrivacySettings initial={{ profile_visibility: stats?.profile_visibility ?? "PUBLIC", challenge_permission: stats?.challenge_permission ?? "FRIENDS", group_invite_permission: stats?.group_invite_permission ?? "FRIENDS" }} />
              </section>
              {analytics ? (
                <section className="flex flex-col gap-3 rounded-[22px] bg-inv p-5 text-on-inv">
                  <h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">Creator stats</h2>
                  <dl className="grid grid-cols-2 gap-3">
                    {[[analytics.active_quests, "Active"], [analytics.entries_received, "Entries"], [analytics.winners_selected, "Winners"], [`${(analytics.rewards_paid_minor / 100_000).toLocaleString(undefined, { maximumFractionDigits: 5 })}`, "NIM paid"]].map(([value, label]) => <div key={label} className="flex flex-col"><dt className="text-xs opacity-70">{label}</dt><dd className="font-display text-2xl font-black">{value}</dd></div>)}
                  </dl>
                </section>
              ) : null}
              <section className="sq-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-lime text-on-lime"><WalletCards size={18} aria-hidden="true" /></span><div className="flex flex-col"><h2 className="text-sm font-bold">Payout address</h2><span className="text-xs text-ink-2">Needed before entering a NIM bounty</span></div></div>
                <PayoutDestinationForm />
                <Link href="/wallet" className="flex items-center justify-between text-sm font-semibold">Rewards and payouts<ChevronRight size={16} aria-hidden="true" /></Link>
              </section>
              <section className="sq-card flex flex-col gap-2 p-5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Signed in with</span>
                <span className="text-sm">{viewer.email ?? "Google account"}</span>
                <form action={signOut}><button type="submit" className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-danger"><LogOut size={16} aria-hidden="true" />Sign out</button></form>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
