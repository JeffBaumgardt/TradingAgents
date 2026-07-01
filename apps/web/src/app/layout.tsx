/**
 * @file apps/web/src/app/layout.tsx
 * Root layout with site chrome and global styles.
 */

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import SiteHeader from "@/components/SiteHeader";
import AuthUserSync from "@/components/AuthUserSync";
import { UserSessionProvider } from "@/context/UserSessionContext";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradingAgents",
  description: "Multi-agent LLM financial trading analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance}>
          <AuthUserSync />
          <UserSessionProvider>
            <SiteHeader />
            <main>{children}</main>
          </UserSessionProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
