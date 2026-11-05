import { apiFetch, apiUrl } from "@/lib/api/quests";

export type FriendPerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  state: "ACCEPTED" | "INCOMING" | "OUTGOING";
  since: string;
};

export type FriendGroup = {
  id: string;
  owner_id: string;
  name: string;
  avatar_url: string | null;
  invite_code: string;
  member_count: number;
  active_challenges: number;
  viewer_role: "OWNER" | "MEMBER";
  created_at: string;
};

export type GroupMember = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "OWNER" | "MEMBER";
  season_wins: number;
};

export type FriendsChallenge = {
  id: string;
  title: string;
  status: string;
  deadline: string;
  votes_close_at: string;
  winner_selection_method: "FIRST_VALID" | "BEST_SUBMISSION" | "ROOM_VOTE";
  friendly_stake: string | null;
  cover_media_url: string | null;
  creator_display_name: string;
  entries_received: number;
  viewer_entered: boolean;
  viewer_voted: boolean;
};

export type GroupRoom = { group: FriendGroup; members: GroupMember[]; challenges: FriendsChallenge[] };

export type VoteCandidate = {
  entry_id: string;
  participant_id: string;
  participant_display_name: string;
  participant_avatar_url: string | null;
  caption: string | null;
  media_url: string | null;
  submitted_at: string;
  votes: number | null;
};

export type VoteBallot = {
  quest_id: string;
  title: string;
  group_name: string | null;
  deadline: string;
  votes_close_at: string;
  phase: "SUBMITTING" | "VOTING" | "CLOSED";
  winner_count: number;
  viewer_vote: string | null;
  viewer_can_vote: boolean;
  candidates: VoteCandidate[];
};

export type GroupInvitePreview = { id: string; name: string; owner_display_name: string; member_count: number; viewer_is_member: boolean };

async function authorized<T>(path: string, accessToken: string, fallback: T): Promise<T> {
  const response = await apiFetch(apiUrl(path), { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).catch(() => null);
  if (!response?.ok) return fallback;
  return response.json() as Promise<T>;
}

export const listFriends = (token: string) => authorized<FriendPerson[]>("/friends", token, []);
export const listGroups = (token: string) => authorized<FriendGroup[]>("/friends/groups", token, []);
export const listFriendsChallenges = (token: string) => authorized<FriendsChallenge[]>("/friends/challenges", token, []);
export const getGroupRoom = (id: string, token: string) => authorized<GroupRoom | null>(`/friends/groups/${encodeURIComponent(id)}`, token, null);
export const getBallot = (questId: string, token: string) => authorized<VoteBallot | null>(`/quests/${encodeURIComponent(questId)}/vote`, token, null);

export async function previewGroupInvite(code: string, token?: string): Promise<GroupInvitePreview | null> {
  const response = await apiFetch(apiUrl(`/g/${encodeURIComponent(code)}`), { headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  return response.json() as Promise<GroupInvitePreview>;
}

/** Labels a Friends challenge by where it is in its life: submitting, voting or finished. */
export function challengePhase(challenge: Pick<FriendsChallenge, "status" | "deadline" | "votes_close_at" | "winner_selection_method">) {
  const now = Date.now();
  if (challenge.status === "FINALIZED") return "FINISHED" as const;
  if (new Date(challenge.deadline).getTime() > now) return "OPEN" as const;
  if (challenge.winner_selection_method === "ROOM_VOTE" && new Date(challenge.votes_close_at).getTime() > now) return "VOTING" as const;
  return "CLOSING" as const;
}

export function hoursLeft(iso: string) {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
}
