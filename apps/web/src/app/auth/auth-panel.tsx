"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ChevronLeft, LoaderCircle, Lock, MailCheck, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthPanel({ destination }: { destination: string }) {
  const safeDestination = () => destination;
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();
  const returningToQuest = ["/quests/", "/q/", "/invite/", "/g/"].some((prefix) => destination.startsWith(prefix));

  async function signInWithGoogle() {
    if (!configured) return setMessage("Add the Supabase project credentials to enable sign-in.");
    setLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeDestination())}` },
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
    setMessage(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeDestination())}` },
    });
    setLoading(false);
    if (error) setMessage(error.message);
    else setSentTo(email);
  }

  return (
    <main className="flex min-h-screen flex-wrap bg-bg text-ink">
      <aside className="relative hidden min-h-[520px] min-w-0 flex-[1_1_480px] overflow-hidden bg-sunken md:block">
        <img src="/art/scene-signin.svg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-[50%_60%]" />
        <div className="absolute left-7 top-7 rounded-full bg-surface py-2 pl-2 pr-4 shadow-[0_4px_12px_rgba(17,17,17,0.12)]"><Logo size="sm" /></div>
        <figure className="absolute bottom-7 left-7 right-7 m-0 flex max-w-[460px] flex-col gap-4 rounded-[24px] bg-surface p-6 shadow-[0_1px_2px_rgba(17,17,17,0.06),0_12px_32px_rgba(17,17,17,0.12)]">
          <blockquote className="m-0 font-display text-[22px] font-extrabold uppercase leading-tight tracking-[-0.01em]">&ldquo;We did the sunset trail on a Tuesday and it felt like a holiday. I had lived in Lekki for six years.&rdquo;</blockquote>
          <figcaption className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-coral-tint text-[13px] font-bold">TA</span>
            <div className="flex flex-col"><span className="text-sm font-semibold">Tolu Adeyemi</span><span className="text-xs text-ink-2">@tolu · 9 quests completed</span></div>
            <span className="sq-pill ml-auto bg-lime-tint text-ink">Hunt</span>
          </figcaption>
        </figure>
      </aside>

      <section className="flex min-w-0 flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold"><ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />Back</Link>
            <div className="md:hidden"><Logo size="sm" /></div>
          </div>

          {sentTo ? (
            <div className="flex flex-col gap-5" role="status">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-lime text-on-lime"><MailCheck size={28} aria-hidden="true" /></span>
              <h1 className="sq-display text-[44px]">Check your email</h1>
              <p className="text-base leading-normal text-ink-2">We sent a sign-in link to <strong className="text-ink">{sentTo}</strong>. It works for 15 minutes and brings you right back here.</p>
              <button type="button" onClick={() => setSentTo(null)} className="sq-btn sq-btn-ghost">Use a different email</button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="sq-display text-[44px] !leading-[0.92] !tracking-[-0.035em]">Welcome to SideQuest</h1>
                <p className="text-base leading-normal text-ink-2">Sign in to join quests, submit proof and keep your streak. No wallet needed.</p>
              </div>
              {returningToQuest ? (
                <div className="flex items-center gap-2.5 rounded-[14px] bg-lime-tint px-3.5 py-3 text-sm font-medium text-ink">
                  <MapPin size={18} aria-hidden="true" />
                  <span>You&apos;ll return to the quest you picked.</span>
                </div>
              ) : null}
              <button type="button" disabled={loading} onClick={signInWithGoogle} className="sq-btn sq-btn-ghost h-[54px]">
                <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-sunken text-[13px] font-extrabold tracking-normal">G</span>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 text-[13px] text-ink-3"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
              <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
                <label htmlFor="email" className="sq-field-label">Email address</label>
                <input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-[52px] rounded-[14px] border-2 border-ink bg-surface px-3.5 text-[15px] outline-none" />
                <span className="text-xs text-ink-3">We&apos;ll send a one-time link. It works for 15 minutes.</span>
                <button type="submit" disabled={loading} className="sq-btn sq-btn-lime mt-1 h-[54px]">{loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}Email me a sign-in link</button>
              </form>
              <div className="flex h-[54px] items-center justify-between rounded-full bg-sunken px-4 text-[13px] font-extrabold uppercase tracking-[0.12em] text-ink-3" aria-disabled="true">
                <span className="flex items-center gap-2.5"><Lock size={18} aria-hidden="true" />Apple sign-in</span>
                <span className="sq-pill bg-surface">Coming soon</span>
              </div>
            </>
          )}

          {message ? <p role="alert" className="rounded-[14px] bg-lime-tint px-4 py-3 text-sm leading-5 text-ink">{message}</p> : null}
          <Link href="/discover" className="text-sm font-bold underline decoration-2 underline-offset-4">Browse quests as a guest</Link>
          <p className="text-xs leading-normal text-ink-3">By continuing you agree to the Terms and Privacy policy. We never post anything without asking.</p>
        </div>
      </section>
    </main>
  );
}
