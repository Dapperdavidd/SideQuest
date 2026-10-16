import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Compass, Plus, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { getMyQuests, getSavedQuests } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { MyQuestsList } from "./my-quests-list";

export default function MyQuestsPage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><MyQuestsExperience /></Suspense>;
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

  return <main className="min-h-screen bg-background text-foreground"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4 sm:px-8"><Logo /><nav className="ml-auto flex items-center gap-2"><Link href="/discover" aria-label="Discover" className="grid h-10 w-10 place-items-center rounded-full border border-line"><Compass size={18} /></Link><Link href="/profile" aria-label="Profile" className="grid h-10 w-10 place-items-center rounded-full border border-line"><UserRound size={18} /></Link></nav></div></header><div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted">Keep every commitment in view.</p><h1 className="mt-1 font-display text-4xl font-bold tracking-tight">My quests</h1></div><Link href="/create" className="flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-dark"><Plus size={17} /> Create quest</Link></div><MyQuestsList quests={[...quests, ...savedQuests]} /></div></main>;
}
