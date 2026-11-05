import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getMyQuests, getSavedQuests } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { MyQuestsList } from "./my-quests-list";

export default function MyQuestsPage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-sunken" />}><MyQuestsExperience /></Suspense>;
}

async function MyQuestsExperience() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/quests");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth?next=/quests");
  const [quests, savedQuests] = await Promise.all([
    getMyQuests(session.access_token),
    getSavedQuests(session.access_token),
  ]);

  return <AppShell active="quests" viewer={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl, username: viewer.username }}><div className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="sq-label text-ink-2">Your adventures</p><h1 className="sq-display mt-3 text-[clamp(48px,6vw,88px)]">My quests</h1><p className="mt-2 text-sm text-ink-2">Everything you joined, made or saved, in one place.</p></div><Link href="/create" className="sq-btn sq-btn-lime"><Plus size={17} aria-hidden="true" />Start a quest</Link></div><MyQuestsList quests={[...quests, ...savedQuests]} /></div></div></AppShell>;
}
