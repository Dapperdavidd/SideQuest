"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

type ShareQuestButtonProps = {
  questId: string;
  title: string;
};

function copyWithoutClipboard(value: string) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  document.body.removeChild(field);
}

export function ShareQuestButton({ questId, title }: ShareQuestButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(`/quests/${questId}`, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Join “${title}” on SideQuest.`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    } else {
      copyWithoutClipboard(url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <button onClick={share} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-bold">
      {copied ? <Check size={17} /> : <Share2 size={17} />}
      {copied ? "Link copied" : "Share quest"}
    </button>
  );
}
