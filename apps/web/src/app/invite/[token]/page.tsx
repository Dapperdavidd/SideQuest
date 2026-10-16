import { Suspense } from "react";
import { InviteAcceptance } from "./invite-acceptance";

type InvitePageProps = { params: Promise<{ token: string }> };

export default function InvitePage(props: InvitePageProps) {
  return <Suspense fallback={<main className="min-h-screen animate-pulse bg-background" />}><InviteContent {...props} /></Suspense>;
}

async function InviteContent({ params }: InvitePageProps) {
  const { token } = await params;
  return <InviteAcceptance token={token} />;
}
