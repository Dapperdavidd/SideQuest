import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock3, Lock, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { SpotsMeter } from "@/components/spots-meter";
import { formatCountdown, getQuest, isHunt, questCover, resolveShortCode, rewardAmount } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/server";
import { OpenInAppButton } from "./open-in-app";

export const metadata = { title: "Quest link" };

/** Web landing for sdqst.app/q/CODE when the app is not installed. */
export default function ShortLinkPage(props: PageProps<"/q/[code]">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><ShortLinkPageContent {...props} /></Suspense>;
}

async function ShortLinkPageContent({ params, searchParams }: PageProps<"/q/[code]">) {
  const { code } = await params;
  const { web } = await searchParams;
  const target = await resolveShortCode(code).catch(() => null);
  if (!target) notFound();
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const quest = await getQuest(target.quest_id, session?.access_token).catch(() => null);
  if (quest && web === "1") redirect(`/quests/${quest.id}`);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-ink">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-5 pb-7 pt-8">
        <Logo size="sm" />
        {quest ? (
          <article aria-labelledby="dl-title" className="overflow-hidden rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(17,17,17,0.06),0_12px_32px_rgba(17,17,17,0.08)]">
            <div className="relative h-[168px] overflow-hidden bg-violet">
              <img src={questCover(quest)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute left-3 top-3 flex gap-1.5"><span className="sq-pill bg-lime text-[#111111]">{quest.quest_type === "FRIENDS" ? "Friends" : "Bounty"}</span>{isHunt(quest) ? <span className="sq-pill bg-lime-tint text-ink">Hunt</span> : null}</div>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1.5">
                <h1 id="dl-title" className="sq-display text-[30px] !leading-[0.92] !tracking-[-0.035em]">{quest.title}</h1>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2"><MapPin size={14} aria-hidden="true" />{[quest.organization_display_name ?? quest.creator_display_name, quest.location_name, isHunt(quest) ? `${quest.checkpoint_count} QR stops` : null].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="sq-pill bg-lime font-mono !text-sm !tracking-normal text-[#111111]">{rewardAmount(quest) ?? "Recognition"}</span>
                <span className="flex items-center gap-1.5 text-[13px] text-ink-2"><Clock3 size={14} aria-hidden="true" />Ends in <span className="font-mono font-semibold text-ink">{formatCountdown(quest.deadline)}</span></span>
              </div>
              <div className="flex flex-col gap-1.5"><SpotsMeter total={quest.max_entries} used={Math.min(quest.entries_received, quest.max_entries)} /><span className="text-xs text-ink-2">{Math.max(0, quest.max_entries - quest.entries_received)} of {quest.max_entries} spots left · {quest.winner_count} winner{quest.winner_count === 1 ? "" : "s"}</span></div>
            </div>
          </article>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[24px] border border-line bg-surface p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-coral text-[#111111]"><Lock size={24} aria-hidden="true" /></span>
            <h1 className="sq-display text-[34px]">This challenge is private.</h1>
            <p className="text-sm text-ink-2">Ask {target.creator_display_name} to add you, then open the link again.</p>
            {!session ? <Link href={`/auth?next=/q/${code}`} className="sq-btn sq-btn-ghost">Sign in</Link> : null}
          </div>
        )}
      </div>
      {quest ? (
        <footer className="mx-auto flex w-full max-w-[480px] flex-col gap-2.5 px-5 pb-7">
          <OpenInAppButton code={target.short_code} />
          <Link href={`/quests/${quest.id}`} className="sq-btn sq-btn-ghost h-[54px] w-full">Continue on web</Link>
          <span className="text-center text-[13px] text-ink-2">New to SideQuest? <Link href="/" className="font-semibold">See how it works</Link></span>
        </footer>
      ) : null}
    </main>
  );
}
