export type Quest = {
  id: string;
  creator_id: string;
  creator_username: string;
  creator_display_name: string;
  creator_avatar_url: string | null;
  title: string;
  description: string;
  cover_media_url: string | null;
  quest_type: "FRIENDS" | "BOUNTY" | "EXPLORE";
  visibility: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  is_group_challenge: boolean;
  required_group_size: number | null;
  max_entries: number;
  winner_count: number;
  winner_selection_method: "FIRST_VALID" | "BEST_SUBMISSION";
  proof_requirements: string[];
  judging_criteria: string | null;
  reward_enabled: boolean;
  reward_amount_minor: number | null;
  reward_currency: string | null;
  settlement_asset: string | null;
  deadline: string;
  status: string;
  entries_received: number;
  participants_joined: number;
  created_at: string;
  published_at: string | null;
};

export type ApiErrorBody = {
  code?: string;
  message?: string;
};

export type CreatorEntry = {
  id: string;
  participant_id: string;
  participant_username: string;
  participant_display_name: string;
  participant_avatar_url: string | null;
  caption: string | null;
  submitted_at: string;
  review_is_valid: boolean | null;
  review_reason: string | null;
  evidence: { proof_type: string; value: string }[];
};

export type MyQuestSummary = {
  id: string;
  title: string;
  quest_type: "FRIENDS" | "BOUNTY" | "EXPLORE";
  status: string;
  relationship: "CREATOR" | "PARTICIPANT";
  deadline: string;
  entries_received: number;
  max_entries: number;
  participants_joined: number;
  reward_enabled: boolean;
  reward_amount_minor: number | null;
  reward_currency: string | null;
  published_at: string | null;
};

export function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function listQuests(): Promise<Quest[]> {
  const response = await fetch(apiUrl("/quests"), { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load quests right now.");
  return response.json() as Promise<Quest[]>;
}

export async function getQuest(id: string): Promise<Quest | null> {
  const response = await fetch(apiUrl(`/quests/${encodeURIComponent(id)}`), {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load this quest right now.");
  return response.json() as Promise<Quest>;
}

export async function getMyQuests(accessToken: string): Promise<MyQuestSummary[]> {
  const response = await fetch(apiUrl("/users/me/quests"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load your quests right now.");
  return response.json() as Promise<MyQuestSummary[]>;
}

export async function readApiError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  return body?.message ?? fallback;
}

export function formatReward(quest: Quest) {
  if (!quest.reward_enabled || quest.reward_amount_minor === null) return "Just for fun";
  const amount = quest.reward_amount_minor / 100_000;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 5 }).format(amount)} NIM`;
}

export function formatDeadline(deadline: string) {
  const milliseconds = new Date(deadline).getTime() - Date.now();
  if (milliseconds <= 0) return "Closed";
  const days = Math.ceil(milliseconds / 86_400_000);
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function questImageClass(type: Quest["quest_type"]) {
  if (type === "BOUNTY") return "photo-coffee";
  if (type === "FRIENDS") return "photo-campus";
  return "photo-sunset";
}
