"use client";

import { useRouter } from "next/navigation";

/**
 * On phones with the app installed, Universal Links / App Links open the app before this page
 * loads. This button covers the rest: it tries the app's URL scheme, then stays on the web.
 */
export function OpenInAppButton({ code }: { code: string }) {
  const router = useRouter();
  return (
    <a
      href={`sidequest://q/${code}`}
      onClick={() => {
        window.setTimeout(() => router.push(`/q/${code}?web=1`), 1200);
      }}
      className="sq-btn sq-btn-lime h-[54px] w-full"
    >
      Open in the SideQuest app
    </a>
  );
}
