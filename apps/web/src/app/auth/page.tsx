import { Suspense } from "react";
import { AuthPanel } from "./auth-panel";

export default function AuthPage(props: PageProps<"/auth">) {
  return <Suspense fallback={<main className="min-h-screen bg-bg" />}><AuthWithDestination {...props} /></Suspense>;
}

async function AuthWithDestination({ searchParams }: PageProps<"/auth">) {
  const { next } = await searchParams;
  const requested = typeof next === "string" ? next : null;
  const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/discover";
  return <AuthPanel destination={destination} />;
}
