import { apiUrl, readApiError } from "@/lib/api/quests";

export type AdminReport = {
  id: string;
  reporter_username: string;
  reporter_display_name: string;
  subject_type: "QUEST" | "USER";
  quest_id: string | null;
  quest_title: string | null;
  user_id: string | null;
  user_username: string | null;
  user_display_name: string | null;
  reason: "SAFETY" | "SPAM" | "HARASSMENT" | "MISLEADING" | "INAPPROPRIATE" | "OTHER";
  details: string | null;
  status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminOrganization = {
  id: string;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  slug: string;
  display_name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
  verification_reason: string | null;
  created_at: string;
  verified_at: string | null;
};

export type FailedPayout = {
  id: string;
  quest_id: string;
  quest_title: string;
  recipient_username: string;
  recipient_display_name: string;
  amount_luna: number;
  amount_nim: string;
  destination_address: string;
  transaction_hash: string;
  failure_reason: string | null;
  current_attempt: number;
  updated_at: string;
};

export type SuspendedQuest = {
  suspension_id: string;
  quest_id: string;
  title: string;
  creator_username: string;
  creator_display_name: string;
  previous_status: string;
  reason: string;
  suspended_at: string;
};

export type SuspendedUser = {
  suspension_id: string;
  user_id: string;
  username: string;
  display_name: string;
  reason: string;
  suspended_at: string;
};

export class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function adminResponse<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new AdminApiError(await readApiError(response, "Unable to load the operations queue."), response.status);
  return response.json() as Promise<T>;
}

export function getAdminReports(status: AdminReport["status"], accessToken: string) {
  return adminResponse<AdminReport[]>(`/admin/reports?status=${status}`, accessToken);
}

export function getAdminOrganizations(status: AdminOrganization["verification_status"], accessToken: string) {
  return adminResponse<AdminOrganization[]>(`/admin/organizations?status=${status}`, accessToken);
}

export function getFailedPayouts(accessToken: string) {
  return adminResponse<FailedPayout[]>("/admin/payouts/failed", accessToken);
}

export function getSuspendedQuests(accessToken: string) {
  return adminResponse<SuspendedQuest[]>("/admin/quests/suspended", accessToken);
}

export function getSuspendedUsers(accessToken: string) {
  return adminResponse<SuspendedUser[]>("/admin/users/suspended", accessToken);
}

export async function decideReport(reportId: string, status: "REVIEWING" | "RESOLVED" | "DISMISSED", note: string | null, accessToken: string) {
  const response = await fetch(apiUrl(`/admin/reports/${encodeURIComponent(reportId)}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!response.ok) throw new AdminApiError(await readApiError(response, "The report decision could not be saved."), response.status);
}

export async function decideOrganization(organizationId: string, status: "VERIFIED" | "REJECTED", reason: string | null, accessToken: string) {
  const response = await fetch(apiUrl(`/admin/organizations/${encodeURIComponent(organizationId)}/verification`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });
  if (!response.ok) throw new AdminApiError(await readApiError(response, "The verification decision could not be saved."), response.status);
}

export async function retryFailedPayout(payoutId: string, accessToken: string) {
  const response = await fetch(apiUrl(`/admin/payouts/${encodeURIComponent(payoutId)}/retry`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new AdminApiError(await readApiError(response, "The payout could not be safely retried."), response.status);
}

export async function changeQuestSuspension(questId: string, action: "suspend" | "reinstate", reason: string, accessToken: string) {
  const response = await fetch(apiUrl(`/admin/quests/${encodeURIComponent(questId)}/${action}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new AdminApiError(await readApiError(response, `The quest could not be ${action === "suspend" ? "suspended" : "reinstated"}.`), response.status);
}

export async function changeUserSuspension(userId: string, action: "suspend" | "reinstate", reason: string, accessToken: string) {
  const response = await fetch(apiUrl(`/admin/users/${encodeURIComponent(userId)}/${action}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new AdminApiError(await readApiError(response, `The account could not be ${action === "suspend" ? "suspended" : "reinstated"}.`), response.status);
}
