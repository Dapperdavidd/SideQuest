import { redirect } from "next/navigation";
import { Suspense } from "react";

/** Followers and following were replaced by mutual friends in v5; old links land on the profile. */
export default function ConnectionPage(props: PageProps<"/users/[username]/[connection]">) {
  return <Suspense fallback={null}><RedirectToProfile {...props} /></Suspense>;
}

async function RedirectToProfile({ params }: PageProps<"/users/[username]/[connection]">): Promise<null> {
  const { username } = await params;
  redirect(`/users/${encodeURIComponent(username)}`);
  return null;
}
