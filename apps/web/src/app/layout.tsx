/**
 * @file apps/web/src/app/layout.tsx
 * Root layout with site chrome and global styles.
 */

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { UserSessionProvider } from "@/context/UserSessionContext";
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
        <UserSessionProvider>
          <SiteHeader />
          <main>{children}</main>
        </UserSessionProvider>
      </body>
    </html>
  );
}
