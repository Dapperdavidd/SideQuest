/** Public origin used for share links and QR codes. */
export function shareOrigin() {
  return (process.env.NEXT_PUBLIC_SHARE_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://sdqst.app").replace(/\/$/, "");
}

export function questShareUrl(shortCode: string | null | undefined, questId: string) {
  return shortCode ? `${shareOrigin()}/q/${shortCode}` : `${shareOrigin()}/quests/${questId}`;
}

export function displayShareUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}
