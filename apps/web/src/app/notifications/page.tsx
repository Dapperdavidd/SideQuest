import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { getNotifications } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/server";
import { NotificationList } from "./notification-list";

export default function NotificationsPage() {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><NotificationsExperience /></Suspense>;
}

async function NotificationsExperience() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth?next=/notifications");
  const notifications = await getNotifications(session.access_token);

  return <main className="min-h-screen bg-background text-foreground"><header className="border-b border-line bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8"><Logo /><Link href="/discover" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold"><ArrowLeft size={16} />Discover</Link></div></header><div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10"><p className="text-sm text-muted">Everything that needs your attention, in one place.</p><h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Notifications</h1><NotificationList initialNotifications={notifications} /></div></main>;
}
