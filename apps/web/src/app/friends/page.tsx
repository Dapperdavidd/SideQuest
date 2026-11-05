import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Swords } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { AddFriendForm, FriendRequestActions, NewGroupForm } from "@/components/friends-actions";
import { ChallengeRow } from "@/components/challenge-row";
import { challengePhase, listFriends, listFriendsChallenges, listGroups } from "@/lib/api/friends";
import { getUnreadNotificationCount, questCover } from "@/lib/api/quests";
import { getViewerForUser } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Friends" };

export default function FriendsPage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><FriendsHome /></Suspense>;
}

const groupTones = ["bg-coral text-[#111111]", "bg-violet text-white", "bg-lime text-on-lime", "bg-inv text-on-inv"];

async function FriendsHome() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth?next=/friends");
  const token = session.access_token;
  const [viewer, people, groups, challenges, unread] = await Promise.all([
    getViewerForUser(supabase, session.user),
    listFriends(token),
    listGroups(token),
    listFriendsChallenges(token),
    getUnreadNotificationCount(token),
  ]);
  const friends = people.filter((person) => person.state === "ACCEPTED");
  const requests = people.filter((person) => person.state !== "ACCEPTED");
  const live = challenges.filter((challenge) => challengePhase(challenge) !== "FINISHED");
  const finished = challenges.filter((challenge) => challengePhase(challenge) === "FINISHED").slice(0, 6);

  return (
    <AppShell active="friends" viewer={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username }} unreadNotifications={unread}>
      <div className="px-4 pb-16 pt-8 sm:px-8 lg:px-9 lg:pt-9">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-start gap-7">
          <aside aria-label="Groups and friends" className="flex min-w-0 flex-[1_1_250px] flex-col gap-4">
            <div className="flex flex-col gap-3.5">
              <h1 className="sq-display text-[52px]">Friends</h1>
              <Link href="/create?mode=friends" className="sq-btn sq-btn-lime"><Swords size={17} aria-hidden="true" />Challenge friends</Link>
            </div>
            <section className="sq-card flex flex-col gap-1 p-2">
              <h2 className="px-2.5 pb-1.5 pt-2 text-[13px] font-semibold text-ink-2">Your groups</h2>
              {groups.map((group, index) => (
                <Link key={group.id} href={`/friends/groups/${group.id}`} className="flex items-center gap-2.5 rounded-xl p-2.5 hover:bg-sunken">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-extrabold ${groupTones[index % groupTones.length]}`}>{group.name.slice(0, 2).toUpperCase()}</span>
                  <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[15px] font-semibold">{group.name}</span><span className="text-xs text-ink-2">{group.member_count} member{group.member_count === 1 ? "" : "s"}</span></span>
                  {group.active_challenges ? <span className="sq-pill bg-coral-tint text-ink">{group.active_challenges} live</span> : null}
                </Link>
              ))}
              <NewGroupForm />
            </section>
            <section className="sq-card flex flex-col gap-3.5 p-4">
              <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">Friends</h2><span className="text-[13px] text-ink-2">{friends.length}</span></div>
              {requests.length ? (
                <div className="flex flex-col gap-2.5 rounded-2xl bg-sunken p-3">
                  <span className="sq-label !text-[10px] text-ink-2">Requests</span>
                  {requests.map((person) => (
                    <div key={person.id} className="flex items-center gap-2.5">
                      <Avatar name={person.display_name} url={person.avatar_url} size={32} tone="coral" />
                      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-semibold">{person.display_name}</span><span className="text-xs text-ink-2">{person.state === "INCOMING" ? "wants to be friends" : "request sent"}</span></span>
                      <FriendRequestActions userId={person.id} incoming={person.state === "INCOMING"} />
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-2.5">
                {friends.slice(0, 8).map((person, index) => (
                  <Link key={person.id} href={`/users/${person.username}`} className="flex items-center gap-2.5">
                    <Avatar name={person.display_name} url={person.avatar_url} size={32} tone={(["lime", "coral", "sunken", "inv"] as const)[index % 4]} />
                    <span className="flex min-w-0 flex-col"><span className="truncate text-sm font-semibold">{person.display_name}</span><span className="text-xs text-ink-2">@{person.username}</span></span>
                  </Link>
                ))}
                {!friends.length ? <p className="text-sm text-ink-2">No friends yet. Add someone by their username.</p> : null}
              </div>
              <AddFriendForm />
            </section>
          </aside>

          <section aria-labelledby="challenges-h" className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3"><h2 id="challenges-h" className="font-display text-[30px] font-black uppercase leading-none tracking-[-0.04em]">Your challenges</h2><span className="font-mono text-xs font-bold text-ink-3">{live.length} LIVE</span></div>
            {live.length ? live.map((challenge) => <ChallengeRow key={challenge.id} challenge={challenge} />) : (
              <div className="sq-card flex flex-col items-start gap-4 p-7">
                <span className="sq-sticker sq-sticker-coral -rotate-2">No challenges yet</span>
                <h3 className="sq-display text-[36px]">Dare your people.</h3>
                <p className="max-w-md text-sm leading-6 text-ink-2">Cook-offs, photo recreations, sunset runs. Send a challenge to your friends or a group, then the room votes the winner.</p>
                <Link href="/create?mode=friends" className="sq-btn sq-btn-inv">Start a challenge</Link>
              </div>
            )}
            {finished.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {finished.map((challenge) => (
                  <Link key={challenge.id} href={`/quests/${challenge.id}`} className="sq-card flex items-center gap-3.5 p-4">
                    <img src={questCover({ id: challenge.id, cover_media_url: challenge.cover_media_url, quest_type: "FRIENDS" })} alt="" className="h-14 w-14 flex-none rounded-[14px] object-cover" />
                    <span className="flex min-w-0 flex-col gap-1"><span className="sq-pill self-start bg-sunken text-ink-2">Finished</span><span className="truncate text-base font-semibold">{challenge.title}</span></span>
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="flex min-w-0 flex-[1_1_230px] flex-col gap-4">
            <section className="sq-card flex flex-col gap-2 p-5">
              <h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">How rooms work</h2>
              <p className="text-[13px] leading-snug text-ink-2">Friends challenges never show on Discover. After each deadline the room votes for 24 hours, one vote each, never for yourself. Ties share the win.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-[22px] bg-inv p-5 text-on-inv">
              <h2 className="font-display text-lg font-black uppercase tracking-[-0.02em]">No money between friends</h2>
              <p className="text-[13px] leading-snug opacity-80">Stakes are text only, like &ldquo;Loser buys suya&rdquo;. Play for bragging rights and badges.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
