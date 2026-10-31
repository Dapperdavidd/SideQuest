"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Mail, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AuthPage() {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  function destination() {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/discover";
  }

  async function signInWithGoogle() {
    if (!configured) return setMessage("Add the Supabase project credentials to enable sign-in.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination())}` },
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination())}` },
    });
    setLoading(false);
    setMessage(error?.message ?? "Check your inbox for your secure sign-in link.");
  }

  return (
    <main className="grid min-h-screen bg-dark lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col"><div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(199,255,0,.25),transparent_25%),radial-gradient(circle_at_85%_80%,rgba(119,92,255,.22),transparent_28%)]" /><div className="relative"><Logo inverse /></div><div className="relative my-auto max-w-xl"><span className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-accent"><Sparkles size={14} />Your next story starts here</span><h1 className="mt-6 font-display text-6xl font-extrabold leading-[.95] tracking-[-0.065em]">Ordinary day.<br />Unexpected quest.</h1><p className="mt-5 max-w-md text-base leading-7 text-white/55">Join people around you doing small, memorable things—then bring your own ideas to life.</p><ul className="mt-8 space-y-3 text-sm font-semibold text-white/75">{["Find something fun in seconds", "Join friends or meet your community", "Share the moment when you’re done"].map((item) => <li key={item} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-dark"><Check size={14} /></span>{item}</li>)}</ul></div></section>
      <section className="grid place-items-center bg-[#f4f1e8] px-5 py-10"><div className="w-full max-w-md rounded-[1.75rem] border border-black/8 bg-white p-7 text-center shadow-[0_24px_80px_rgba(23,25,23,0.09)] sm:p-10">
        <div className="lg:hidden"><Logo /></div>
        <p className="app-eyebrow mt-8 lg:mt-0">One tap from adventure</p><h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.045em]">Welcome to SideQuest</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted">Sign in when you’re ready to join, create, or save a quest.</p>
        <div className="mt-8 space-y-3">
          <button disabled={loading} onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-full border border-line px-5 py-3.5 font-semibold transition hover:bg-background disabled:opacity-50"><span className="text-lg font-bold text-[#4285F4]">G</span>Continue with Google</button>
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
        <Link href="/discover" className="mt-5 inline-flex items-center gap-2 text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"><ArrowLeft size={15} />Browse quests as a guest</Link>
      </div></section>
    </main>
  );
}
