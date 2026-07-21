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
          <Link href="/dashboard" className="muted" style={{ textDecoration: "none" }}>
            ← Back to dashboard
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
        server and are never shown again in the browser after you save them. On the Hosted plan,
        providers without your key run on platform keys; providers with your key stay on your bill
        and do not use the hosted allowance.{" "}
        <Link href="/settings/billing">View billing & usage</Link>
        {" · "}
        <Link href="/checkout?plan=hosted&interval=monthly">Upgrade to Hosted</Link>
      </p>
      <CredentialsSetup
        initialSchema={initialSchema}
        onSuccess={() => {
          router.push("/dashboard");
        }}
        continueLabel={
          credentialsReady ? "Save keys and return to dashboard" : "Save keys and start setup"
        }
      />
    </>
  );
}
