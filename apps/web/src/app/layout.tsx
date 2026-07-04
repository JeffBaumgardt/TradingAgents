/**
 * @file apps/web/src/app/layout.tsx
 * Root layout with global providers and styles.
 */

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import AuthUserSync from "@/components/AuthUserSync";
import ThemeScript from "@/components/ThemeScript";
import { ThemeProvider } from "@/context/ThemeContext";
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
            {children}
          </ThemeProvider>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
