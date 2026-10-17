"use client";

import { useState } from "react";
import { Award, Bell, Check, CheckCheck, LoaderCircle, UserPlus, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, type AppNotification } from "@/lib/api/quests";
import { createClient } from "@/lib/supabase/client";

export function NotificationList({ initialNotifications }: { initialNotifications: AppNotification[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [working, setWorking] = useState<string | null>(null);
  const unread = notifications.filter((notification) => !notification.read_at).length;

  async function open(notification: AppNotification) {
    setWorking(notification.id);
    if (!notification.read_at) {
      const { data: { session } } = await createClient().auth.getSession();
      if (session) {
        await fetch(apiUrl(`/users/me/notifications/${notification.id}/read`), {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      }
    }
    router.push(notification.href);
  }

  async function markAllRead() {
    setWorking("all");
    const { data: { session } } = await createClient().auth.getSession();
    if (session) {
      const response = await fetch(apiUrl("/users/me/notifications/read-all"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    }
    setWorking(null);
  }

  return <section className="mt-7"><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-muted">{unread ? `${unread} unread` : "You're all caught up"}</span>{unread ? <button onClick={markAllRead} disabled={working !== null} className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-bold disabled:opacity-50">{working === "all" ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCheck size={15} />}Mark all read</button> : null}</div>{notifications.length ? <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-line bg-white">{notifications.map((notification) => <button key={notification.id} onClick={() => open(notification)} disabled={working === notification.id} className={`flex w-full items-start gap-4 border-b border-line p-5 text-left last:border-b-0 hover:bg-background disabled:opacity-60 ${notification.read_at ? "" : "bg-accent-soft/40"}`}><span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${notification.read_at ? "bg-background" : "bg-accent"}`}>{iconFor(notification.kind)}{!notification.read_at ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#9167ff]" /> : null}</span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><strong className="font-display">{notification.title}</strong><span className="shrink-0 text-[0.65rem] text-muted">{relativeTime(notification.created_at)}</span></span><span className="mt-1 block text-sm leading-6 text-muted">{notification.body}</span></span>{working === notification.id ? <LoaderCircle size={17} className="mt-3 shrink-0 animate-spin" /> : !notification.read_at ? <Check size={17} className="mt-3 shrink-0 text-muted" /> : null}</button>)}</div> : <div className="mt-4 rounded-[1.5rem] border border-dashed border-line bg-white p-12 text-center"><Bell className="mx-auto text-muted" size={28} /><h2 className="mt-4 font-display text-xl font-bold">No notifications yet</h2><p className="mt-2 text-sm text-muted">Quest activity, reviews, follows, results, and rewards will appear here.</p></div>}</section>;
}

function iconFor(kind: AppNotification["kind"]) {
  if (kind === "NEW_FOLLOWER") return <UserPlus size={19} />;
  if (kind === "QUEST_WON") return <Award size={19} />;
  if (kind.startsWith("PAYOUT")) return <WalletCards size={19} />;
  return <Bell size={19} />;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
