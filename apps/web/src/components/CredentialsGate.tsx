/**
 * @file apps/web/src/components/CredentialsGate.tsx
 * Client gate that redirects to API key setup when credentials are missing.
 */

"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/context/UserSessionContext";
import HomePageSkeleton from "@/components/HomePageSkeleton";

interface CredentialsGateProps {
  children: ReactNode;
}

export default function CredentialsGate({ children }: CredentialsGateProps) {
  const router = useRouter();
  const { credentialsReady, hydrating } = useUserSession();

  useEffect(() => {
    if (!hydrating && !credentialsReady) {
      router.replace("/settings/credentials");
    }
  }, [credentialsReady, hydrating, router]);

  if (hydrating) {
    return <HomePageSkeleton />;
  }

  if (!credentialsReady) {
    return null;
  }

  return children;
}
