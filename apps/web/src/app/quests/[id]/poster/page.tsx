import { Suspense } from "react";
import { notFound } from "next/navigation";
import { QrCode } from "@/components/qr-code";
import { getQuest, isHunt, rewardAmount } from "@/lib/api/quests";
import { displayShareUrl, questShareUrl } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata = { title: "QR poster" };

/** A5 printable QR poster. The browser's print dialog saves it as a PDF. */
export default function QuestPosterPage(props: PageProps<"/quests/[id]/poster">) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-bg" />}><QuestPosterPageContent {...props} /></Suspense>;
}

async function QuestPosterPageContent({ params }: PageProps<"/quests/[id]/poster">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const quest = await getQuest(id, session?.access_token);
  if (!quest) notFound();
  const url = questShareUrl(quest.short_code, quest.id);
  const reward = rewardAmount(quest);
  const host = quest.organization_display_name ?? quest.creator_display_name;
  const ends = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(quest.deadline));

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-[#f3f3f5] py-10 text-[#111111] print:block print:bg-white print:p-0">
      <style>{"@page { size: A5; margin: 0; } @media print { html, body { background: #fff !important; } }"}</style>
      <PrintButton />
      <article className="flex h-[210mm] w-[148mm] flex-col gap-[6mm] bg-white p-[12mm] shadow-[0_12px_40px_rgba(17,17,17,0.14)] print:shadow-none">
        <div className="flex items-center justify-between"><span className="font-display text-[26pt] font-black tracking-[-0.05em]">sidequest<span className="text-[#9cc400]">.</span></span><span className="rounded-full bg-[#e0fe5e] px-[3mm] py-[1mm] text-[9pt] font-extrabold uppercase tracking-wider">{quest.quest_type === "FRIENDS" ? "Friends" : isHunt(quest) ? "Bounty · Hunt" : "Bounty"}</span></div>
        <h1 className="font-display text-[34pt] font-black uppercase leading-[0.9] tracking-[-0.045em]">{quest.title}</h1>
        <span className="text-[13pt] font-extrabold uppercase tracking-[0.14em]">Scan to join</span>
        <div className="self-center rounded-[4mm] border border-[#e7e7ea] p-[4mm]"><QrCode value={url} size={260} label={`QR code that opens ${displayShareUrl(url)}`} /></div>
        <div className="mt-auto flex flex-col gap-[2mm] border-t border-[#e7e7ea] pt-[4mm]">
          <span className="text-[13pt] font-bold">{host}{quest.location_name ? <span className="font-medium text-[#55565c]"> · {quest.location_name}</span> : null}</span>
          <div className="flex items-center justify-between"><span className="rounded-full bg-[#e0fe5e] px-[3mm] py-[1mm] font-mono text-[11pt] font-semibold">{reward ? `${reward} × ${quest.winner_count}` : "Recognition"}</span><span className="text-[11pt] text-[#55565c]">Ends {ends}</span></div>
          <span className="font-mono text-[10pt] text-[#6b6c73]">{displayShareUrl(url)}</span>
        </div>
      </article>
    </main>
  );
}
