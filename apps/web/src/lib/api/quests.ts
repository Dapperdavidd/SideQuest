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
  viewer_joined: boolean;
};

export type QuestInvitation = {
  id: string;
  quest_id: string;
  token: string;
  max_uses: number;
  use_count: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
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

export type PublicWinner = {
  winner_position: number;
  participant_username: string;
  participant_display_name: string;
  participant_avatar_url: string | null;
  entry_id: string;
};

export type MyQuestSummary = {
  id: string;
  title: string;
  quest_type: "FRIENDS" | "BOUNTY" | "EXPLORE";
  status: string;
  relationship: "CREATOR" | "PARTICIPANT" | "SAVED";
  deadline: string;
  entries_received: number;
  max_entries: number;
  participants_joined: number;
  reward_enabled: boolean;
  reward_amount_minor: number | null;
  reward_currency: string | null;
  published_at: string | null;
};

export type PayoutSummary = {
  id: string;
  quest_id: string;
  quest_title: string;
  amount_luna: number;
  amount_nim: string;
  status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";
  network: "testnet";
  destination_address: string;
  transaction_hash: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  failure_reason: string | null;
  created_at: string;
};

export type QuestSettlement = {
  quest_id: string;
  status: string;
  reward_enabled: boolean;
  total_allocated_luna: number;
  total_allocated_nim: string;
  payouts: Array<{
    id: string;
    winner_position: number;
    recipient_username: string;
    recipient_display_name: string;
    amount_luna: number;
    amount_nim: string;
    network: string;
    destination_address: string;
    status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";
    transaction_hash: string | null;
    submitted_at: string | null;
    confirmed_at: string | null;
    failure_reason: string | null;
    created_at: string;
  }>;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  followers_count: number;
  following_count: number;
  created_quests_count: number;
  completed_quests_count: number;
  wins_count: number;
};

export function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function listQuests(filters: { search?: string; questType?: Quest["quest_type"] } = {}): Promise<Quest[]> {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.questType) query.set("quest_type", filters.questType);
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(apiUrl(`/quests${suffix}`), { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load quests right now.");
  return response.json() as Promise<Quest[]>;
}

export async function getQuest(id: string, accessToken?: string): Promise<Quest | null> {
  const response = await fetch(apiUrl(`/quests/${encodeURIComponent(id)}`), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load this quest right now.");
  return response.json() as Promise<Quest>;
}

export async function getQuestWinners(id: string): Promise<PublicWinner[]> {
  const response = await fetch(apiUrl(`/quests/${encodeURIComponent(id)}/winners`), {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load quest winners right now.");
  return response.json() as Promise<PublicWinner[]>;
}

export async function getMyQuests(accessToken: string): Promise<MyQuestSummary[]> {
  const response = await fetch(apiUrl("/users/me/quests"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load your quests right now.");
  return response.json() as Promise<MyQuestSummary[]>;
}

export async function getSavedQuests(accessToken: string): Promise<MyQuestSummary[]> {
  const response = await fetch(apiUrl("/users/me/saved-quests"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load your saved quests right now.");
  return response.json() as Promise<MyQuestSummary[]>;
}

export async function getQuestSaved(questId: string, accessToken: string): Promise<boolean> {
  const response = await fetch(apiUrl(`/quests/${encodeURIComponent(questId)}/saved`), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const state = await response.json() as { saved: boolean };
  return state.saved;
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const response = await fetch(apiUrl(`/users/${encodeURIComponent(username)}`), { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load this profile right now.");
  return response.json() as Promise<PublicProfile>;
}

export async function getFollowState(userId: string, accessToken: string): Promise<boolean> {
  const response = await fetch(apiUrl(`/users/${encodeURIComponent(userId)}/follow-state`), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const state = await response.json() as { following: boolean };
  return state.following;
}

export async function getMyPayouts(accessToken: string): Promise<PayoutSummary[]> {
  const response = await fetch(apiUrl("/users/me/payouts"), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load your payouts right now.");
  return response.json() as Promise<PayoutSummary[]>;
}

export async function getQuestSettlement(questId: string, accessToken: string): Promise<QuestSettlement> {
  const response = await fetch(apiUrl(`/quests/${encodeURIComponent(questId)}/settlement`), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load this quest's settlement right now.");
  return response.json() as Promise<QuestSettlement>;
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
