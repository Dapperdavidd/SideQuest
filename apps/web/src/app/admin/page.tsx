import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { AdminApiError, getAdminOrganizations, getAdminReports } from "@/lib/api/admin";
import { createClient } from "@/lib/supabase/server";
import { OperationsConsole } from "./operations-console";

export default function AdminPage() {
  return <Suspense fallback={<AdminLoading />}><AdminContent /></Suspense>;
}

async function AdminContent() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth?next=/admin");

  let accessDenied = false;
  let queue: Awaited<ReturnType<typeof loadAdminQueue>> | null = null;
  try {
    queue = await loadAdminQueue(session.access_token);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 403) accessDenied = true;
    else throw error;
  }
  if (accessDenied) {
    return <AdminShell><div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8"><ShieldCheck size={30} className="text-accent" /><h1 className="mt-5 font-display text-3xl font-bold">Administrator access required</h1><p className="mt-3 max-w-xl leading-7 text-white/55">This operations area is protected by the server’s administrator allowlist. No moderation data was exposed.</p></div></AdminShell>;
  }
  if (!queue) throw new Error("The operations queue could not be loaded.");
  return <AdminShell><OperationsConsole initialReports={[...queue.reviewingReports, ...queue.openReports]} initialOrganizations={queue.organizations} accessToken={session.access_token} /></AdminShell>;
}

async function loadAdminQueue(accessToken: string) {
  const [openReports, reviewingReports, organizations] = await Promise.all([
    getAdminReports("OPEN", accessToken),
    getAdminReports("REVIEWING", accessToken),
    getAdminOrganizations("PENDING", accessToken),
  ]);
  return { openReports, reviewingReports, organizations };
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#101310] p-3 text-white sm:p-5"><div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-6xl rounded-[1.5rem] border border-white/10 bg-[#151815]"><header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8"><Link href="/profile" className="flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={17} />Profile</Link><Logo inverse /><span className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Operations</span></header><div className="px-5 py-8 sm:px-8 sm:py-10">{children}</div></div></main>;
}

function AdminLoading() {
  return <main className="min-h-screen animate-pulse bg-[#101310] p-5"><div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-6xl rounded-[1.5rem] bg-[#151815]" /></main>;
}
