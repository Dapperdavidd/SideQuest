import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { apiUrl, getQuest, type CreatorEntry } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { ReviewWorkspace } from "./review-workspace";

type ReviewPageProps = { params: Promise<{ id: string }> };

export default function ReviewPage(props: ReviewPageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><ReviewExperience {...props} /></Suspense>;
}

async function ReviewExperience({ params }: ReviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const [quest, viewer] = await Promise.all([getQuest(id, session?.access_token), getViewer()]);
  if (!viewer) redirect(`/auth?next=${encodeURIComponent(`/quests/${id}/review`)}`);
  if (!quest || quest.creator_id !== viewer.id) notFound();
  if (!session) redirect(`/auth?next=${encodeURIComponent(`/quests/${id}/review`)}`);
  const entriesResponse = await fetch(apiUrl(`/quests/${id}/entries`), {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!entriesResponse.ok) throw new Error("Unable to load submissions for review.");
  const entries = await entriesResponse.json() as CreatorEntry[];
  const mediaPaths = entries.flatMap((entry) => entry.evidence).filter((item) => item.proof_type === "PHOTO" || item.proof_type === "VIDEO").map((item) => item.value);
  const signedUrls: Record<string, string> = {};
  await Promise.all(mediaPaths.map(async (path) => {
    const { data } = await supabase.storage.from("entry-media").createSignedUrl(path, 3600);
    if (data?.signedUrl) signedUrls[path] = data.signedUrl;
  }));

  return <main className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8"><Logo /><Link href={`/quests/${quest.id}`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold"><ArrowLeft size={16} /> Quest</Link></header><div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10"><ReviewWorkspace quest={quest} initialEntries={entries} initialSignedUrls={signedUrls} /></div></main>;
}
