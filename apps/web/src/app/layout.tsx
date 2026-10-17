import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SideQuest — Life comes with side quests",
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
  themeColor: "#171917",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${GeistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
