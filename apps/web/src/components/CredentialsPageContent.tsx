/**
 * @file apps/web/src/components/CredentialsPageContent.tsx
 * Client shell for the credentials settings page.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CredentialsSchemaResponse } from "@tradingagents/api-types";
import CredentialsSetup from "@/components/CredentialsSetup";
import { useUserSession } from "@/context/UserSessionContext";

interface CredentialsPageContentProps {
  initialSchema?: CredentialsSchemaResponse;
}

export default function CredentialsPageContent({
  initialSchema,
}: CredentialsPageContentProps) {
  const router = useRouter();
  const { credentialsReady } = useUserSession();

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        {credentialsReady ? (
          <Link href="/" className="muted" style={{ textDecoration: "none" }}>
            ← Back to home
          </Link>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Enter at least one provider API key to continue.
          </p>
        )}
      </div>
      <h1 className="pageTitle">Provider API keys</h1>
      <p className="muted pageIntro">
        TradingAgents calls your chosen LLM provider on your behalf. Keys are encrypted on the
        server and are never shown again in the browser after you save them. You need at least one
        provider before starting an analysis.
      </p>
      <CredentialsSetup
        initialSchema={initialSchema}
        onSuccess={() => {
          router.push("/");
        }}
        continueLabel={
          credentialsReady ? "Save keys and return home" : "Save keys and start setup"
        }
      />
    </>
  );
}
