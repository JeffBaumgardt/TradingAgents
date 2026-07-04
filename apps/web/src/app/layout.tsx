/**
 * @file apps/web/src/app/layout.tsx
 * Root layout with site chrome and global styles.
 */

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import SiteHeader from "@/components/SiteHeader";
import AuthUserSync from "@/components/AuthUserSync";
import ThemeScript from "@/components/ThemeScript";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserSessionProvider } from "@/context/UserSessionContext";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradingAgents",
  description: "Multi-agent LLM analysis for stocks and ETFs — configure a run, watch agents collaborate, and read structured reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="paper" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <a href="#main-content" className="skipLink">
          Skip to main content
        </a>
        <ClerkProvider appearance={clerkAppearance}>
          <ThemeProvider>
            <AuthUserSync />
            <UserSessionProvider>
              <SiteHeader />
              <main id="main-content">{children}</main>
            </UserSessionProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
