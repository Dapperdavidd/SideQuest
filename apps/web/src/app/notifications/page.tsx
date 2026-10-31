import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { getNotifications } from "@/lib/api/quests";
import { getViewer } from "@/lib/auth/viewer";
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
  const viewer = await getViewer();

  return <AppShell active="notifications" viewer={viewer ? { displayName: viewer.displayName, avatarUrl: viewer.avatarUrl } : null} unreadNotifications={notifications.filter((item) => !item.read_at).length}><div className="px-4 py-7 sm:px-7 lg:px-9 lg:py-9"><div className="mx-auto max-w-4xl"><p className="app-eyebrow">Stay in the loop</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.05em]">Inbox</h1><p className="mt-2 text-sm text-muted">Quest invites, reactions, wins, and the things that need you.</p><NotificationList initialNotifications={notifications} /></div></div></AppShell>;
}
