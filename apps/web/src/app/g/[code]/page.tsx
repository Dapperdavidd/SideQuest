import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { UsersRound } from "lucide-react";
import { JoinGroupButton } from "@/components/friends-actions";
import { Logo } from "@/components/logo";
import { previewGroupInvite } from "@/lib/api/friends";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Group invite" };

export default function GroupInvitePage(props: PageProps<"/g/[code]">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><GroupInviteContent {...props} /></Suspense>;
}

async function GroupInviteContent({ params }: PageProps<"/g/[code]">) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const group = await previewGroupInvite(code, session?.access_token);
  if (!group) notFound();
  if (group.viewer_is_member) redirect(`/friends/groups/${group.id}`);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-ink">
      <img src="/art/mode-friends.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10"><Logo size="sm" /></header>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-14 pt-6">
        <article aria-labelledby="invite-title" className="flex w-full max-w-[520px] flex-col gap-5 rounded-[28px] bg-surface p-7 shadow-[0_1px_2px_rgba(17,17,17,0.06),0_24px_56px_rgba(17,17,17,0.14)]">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-coral text-[#111111]"><UsersRound size={24} aria-hidden="true" /></span>
          <span className="text-[15px] font-medium text-ink-2"><strong className="text-ink">{group.owner_display_name}</strong> invited you to a group</span>
          <h1 id="invite-title" className="sq-display text-[44px] !leading-[0.92] !tracking-[-0.035em]">{group.name}</h1>
          <span className="text-sm text-ink-2">{group.member_count} member{group.member_count === 1 ? "" : "s"} · private room · challenges are won by vote</span>
          {session ? <JoinGroupButton code={code} /> : <Link href={`/auth?next=/g/${code}`} className="sq-btn sq-btn-lime h-[54px] w-full">Sign in to join</Link>}
          <Link href="/" className="sq-btn sq-btn-ghost h-[54px] w-full">Not for me</Link>
          <p className="border-t border-line pt-4 text-xs text-ink-3">Free to join. No wallet needed. Members see each other&apos;s challenges and entries.</p>
        </article>
      </div>
    </main>
  );
}
