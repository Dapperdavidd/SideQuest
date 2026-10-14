"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Apple, LoaderCircle, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AuthPage() {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function signInWithProvider(provider: "google" | "apple") {
    if (!configured) return setMessage("Add the Supabase project credentials to enable sign-in.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/discover` },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return setMessage("Add the Supabase project credentials to enable email sign-in.");
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/discover` },
    });
    setLoading(false);
    setMessage(error?.message ?? "Check your inbox for your secure sign-in link.");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <section className="w-full max-w-md rounded-[1.75rem] border border-line bg-surface p-7 text-center shadow-[0_24px_80px_rgba(23,25,23,0.09)] sm:p-10">
        <Logo />
        <h1 className="mt-10 font-display text-3xl font-bold tracking-tight">Welcome to SideQuest</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted">Create your account to join quests, submit entries, and make everyday life more interesting.</p>
        <div className="mt-8 space-y-3">
          <button disabled={loading} onClick={() => signInWithProvider("google")} className="flex w-full items-center justify-center gap-3 rounded-full border border-line px-5 py-3.5 font-semibold transition hover:bg-background disabled:opacity-50"><span className="text-lg font-bold text-[#4285F4]">G</span>Continue with Google</button>
          <button disabled={loading} onClick={() => signInWithProvider("apple")} className="flex w-full items-center justify-center gap-3 rounded-full border border-line px-5 py-3.5 font-semibold transition hover:bg-background disabled:opacity-50"><Apple size={19} fill="currentColor" />Continue with Apple</button>
          <button disabled={loading} onClick={() => setEmailOpen((value) => !value)} className="flex w-full items-center justify-center gap-3 rounded-full border border-line px-5 py-3.5 font-semibold transition hover:bg-background disabled:opacity-50"><Mail size={19} />Continue with email</button>
        </div>
        {emailOpen ? (
          <form className="mt-4 rounded-2xl bg-background p-3" onSubmit={sendMagicLink}>
            <label className="sr-only" htmlFor="email">Email address</label>
            <input id="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none" />
            <button disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-dark px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? <LoaderCircle size={16} className="animate-spin" /> : null}Email me a sign-in link</button>
          </form>
        ) : null}
        {message ? <p role="status" className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-left text-xs leading-5 text-dark">{message}</p> : null}
        <p className="mt-7 text-xs leading-5 text-muted">By continuing, you agree to the terms and privacy policy.</p>
        <Link href="/discover" className="mt-5 inline-block text-sm font-bold underline decoration-accent decoration-2 underline-offset-4">Browse quests as a guest</Link>
      </section>
    </main>
  );
}
