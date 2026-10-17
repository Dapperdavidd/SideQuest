import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SideQuest — Everyday adventures",
    short_name: "SideQuest",
    description:
      "Discover challenges, join quests, submit entries, and earn verified NIM rewards.",
    start_url: "/discover",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8f8f5",
    theme_color: "#171917",
    categories: ["lifestyle", "social", "entertainment"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
