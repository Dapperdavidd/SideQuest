import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Swords } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { ChallengeRow } from "@/components/challenge-row";
import { LeaveGroupButton } from "@/components/friends-actions";
import { QrCode } from "@/components/qr-code";
import { getGroupRoom } from "@/lib/api/friends";
import { getUnreadNotificationCount } from "@/lib/api/quests";
import { getViewerForUser } from "@/lib/auth/viewer";
import { displayShareUrl, shareOrigin } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";
import { ShareLinkField } from "@/app/quests/[id]/share/share-actions";

export default function GroupRoomPage(props: PageProps<"/friends/groups/[id]">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><GroupRoomContent {...props} /></Suspense>;
}

const medal = ["bg-lime text-on-lime", "bg-silver text-[#111111]", "bg-coral text-[#111111]"];

async function GroupRoomContent({ params }: PageProps<"/friends/groups/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect(`/auth?next=/friends/groups/${id}`);
  const [viewer, room, unread] = await Promise.all([getViewerForUser(supabase, session.user), getGroupRoom(id, session.access_token), getUnreadNotificationCount(session.access_token)]);
  if (!room) notFound();
  const { group, members, challenges } = room;
  const inviteUrl = `${shareOrigin()}/g/${group.invite_code}`;

  return (
    <AppShell active="friends" viewer={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username }} unreadNotifications={unread}>
      <div className="px-4 pb-16 pt-6 sm:px-8 lg:px-9 lg:pt-8">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
          <Link href="/friends" className="inline-flex min-h-11 items-center gap-1.5 self-start font-mono text-xs font-semibold uppercase tracking-[0.08em]"><ArrowLeft size={14} aria-hidden="true" />Friends</Link>
          <div className="flex flex-wrap items-start gap-7">
            <section aria-label={`${group.name} room`} className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
              <div className="sq-card flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex flex-none items-center">{members.slice(0, 3).map((member, index) => <span key={member.id} className={index ? "-ml-2.5" : ""}><Avatar name={member.display_name} url={member.avatar_url} size={44} tone={(["coral", "lime", "inv"] as const)[index]} ring /></span>)}{members.length > 3 ? <span className="-ml-2.5 grid h-11 w-11 place-items-center rounded-full bg-lime-tint text-sm font-bold shadow-[0_0_0_3px_var(--bg)]">+{members.length - 3}</span> : null}</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="sq-display truncate text-[38px] !leading-none">{group.name}</h1>
                    <span className="text-sm text-ink-2">Private room · {members.length} member{members.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <Link href={`/create?mode=friends&group=${group.id}`} className="sq-btn sq-btn-lime"><Swords size={16} aria-hidden="true" />Challenge the room</Link>
              </div>
              {challenges.length ? challenges.map((challenge) => <ChallengeRow key={challenge.id} challenge={challenge} />) : (
                <div className="sq-card flex flex-col items-start gap-3 p-7"><h2 className="sq-display text-[32px]">Quiet in here.</h2><p className="text-sm text-ink-2">Start the first challenge for {group.name}. Everyone in the room can enter and vote.</p></div>
              )}
            </section>
            <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
              <section className="sq-card flex flex-col gap-3.5 p-5">
                <div className="flex flex-col gap-0.5"><h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">Leaderboard</h2><span className="text-[13px] text-ink-2">Season wins this month</span></div>
                <ol className="flex flex-col gap-2.5">
                  {members.map((member, index) => (
                    <li key={member.id} className="flex items-center gap-2.5">
                      <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold ${member.season_wins && index < 3 ? medal[index] : "bg-sunken text-ink-2"}`}>{index + 1}</span>
                      <Avatar name={member.display_name} url={member.avatar_url} size={30} tone="sunken" />
                      <Link href={`/users/${member.username}`} className="flex-1 truncate text-sm font-semibold">{member.display_name}{member.role === "OWNER" ? <span className="ml-1.5 text-xs font-normal text-ink-3">owner</span> : null}</Link>
                      <span className="font-mono text-sm font-semibold">{member.season_wins}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="sq-card flex flex-col gap-3.5 p-5">
                <h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">Invite to the room</h2>
                <div className="flex items-center gap-3.5"><span className="flex-none rounded-xl border border-line bg-white p-1.5"><QrCode value={inviteUrl} size={84} label={`QR code that opens ${displayShareUrl(inviteUrl)}`} /></span><span className="text-[13px] leading-snug text-ink-2">Anyone who opens this link can join, up to 50 members.</span></div>
                <ShareLinkField url={inviteUrl} display={displayShareUrl(inviteUrl)} />
                <LeaveGroupButton groupId={group.id} owner={group.viewer_role === "OWNER"} />
              </section>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
