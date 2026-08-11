/**
 * @file apps/web/src/app/(marketing)/page.tsx
 * Public marketing landing page with auth redirect to the app home.
 */

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPageContent from "@/components/LandingPageContent";
import { hasCookieAcknowledgment } from "@/lib/cookie-ack";
import {
  LOGGED_IN_HOME_PATH,
  shouldRedirectAuthenticatedUserFromLanding,
} from "@/lib/landing-redirect";

export const metadata: Metadata = {
  title: "TradingAgents — AI market research",
  description:
    "AI-powered multi-agent market research on one managed Agents Model. Standard or Pro plans with a 14-day free trial — no provider keys.",
};

export default async function LandingPage() {
  const { userId } = await auth();

  if (
    shouldRedirectAuthenticatedUserFromLanding({
      userId,
      pathname: "/",
    })
  ) {
    redirect(LOGGED_IN_HOME_PATH);
  }

  const cookieStore = await cookies();
  const cookieAcknowledged = hasCookieAcknowledgment(cookieStore);

  return <LandingPageContent cookieAcknowledged={cookieAcknowledged} />;
}
