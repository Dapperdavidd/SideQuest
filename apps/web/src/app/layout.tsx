import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { ThemeScript } from "@/components/theme-script";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

const interTight = localFont({
  src: [
    { path: "./fonts/inter-tight-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/inter-tight-latin-800-normal.woff2", weight: "800", style: "normal" },
    { path: "./fonts/inter-tight-latin-900-normal.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SideQuest: Life comes with side quests",
    template: "%s · SideQuest",
  },
  description:
    "Discover small challenges, try something new, and turn everyday moments into adventures.",
  applicationName: "SideQuest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SideQuest",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${GeistSans.variable} ${GeistMono.variable} ${interTight.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
