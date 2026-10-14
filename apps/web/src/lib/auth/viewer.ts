import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("username, display_name, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const metadataName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === "string"
        ? user.user_metadata.name
        : null;

  return {
    id: user.id,
    username: profile?.username ?? `explorer_${user.id.slice(0, 8)}`,
    displayName: profile?.display_name ?? metadataName ?? "Explorer",
    bio: profile?.bio ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    email: user.email ?? null,
  };
}
