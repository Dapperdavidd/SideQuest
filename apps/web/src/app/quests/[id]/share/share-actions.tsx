"use client";

import { Check, Copy, Mail, MessageCircle, Send, Share2, Sparkles } from "lucide-react";
import { useState } from "react";

type ShareActionsProps = { url: string; display: string; title: string };

export function ShareLinkField({ url, display }: Pick<ShareActionsProps, "url" | "display">) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="flex gap-2">
      <label htmlFor="short-link" className="sr-only">Short link</label>
      <input id="short-link" type="text" readOnly value={display} onFocus={(event) => event.currentTarget.select()} className="h-[52px] min-w-0 flex-1 rounded-full border border-line bg-sunken px-4 font-mono text-[15px] font-semibold text-ink outline-none" />
      <button type="button" onClick={copy} className="sq-btn sq-btn-lime !min-h-[52px] !px-[18px]">{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

export function ShareTargets({ url, title }: Omit<ShareActionsProps, "display">) {
  const [copied, setCopied] = useState(false);
  const text = `Join “${title}” on SideQuest`;
  const nativeShare = async () => {
    if (navigator.share) await navigator.share({ title, text, url }).catch(() => null);
    else await copy();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(url).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const targets = [
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    { label: "Instagram story", icon: Sparkles, onClick: nativeShare },
    { label: "X", icon: Send, href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { label: "Email", icon: Mail, href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
    { label: copied ? "Copied" : "Copy link", icon: copied ? Check : Copy, onClick: copy },
    { label: "More", icon: Share2, onClick: nativeShare },
  ];
  const cell = "flex flex-col items-center gap-2 rounded-2xl bg-sunken px-2 py-3.5 text-[13px] font-semibold transition hover:bg-lime-tint";
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
      {targets.map(({ label, icon: Icon, href, onClick }) => {
        const inner = <><span className="grid h-11 w-11 place-items-center rounded-full bg-surface"><Icon size={20} aria-hidden="true" /></span>{label}</>;
        return href ? <a key={label} href={href} target="_blank" rel="noreferrer" className={cell}>{inner}</a> : <button key={label} type="button" onClick={onClick} className={cell}>{inner}</button>;
      })}
    </div>
  );
}
