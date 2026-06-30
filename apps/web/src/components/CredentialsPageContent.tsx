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
  initialSchema: CredentialsSchemaResponse;
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
      <h1 style={{ marginBottom: "0.25rem" }}>API Keys</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1.5rem" }}>
        Keys stay in this browser tab only — they are never saved to the server.
      </p>
      <CredentialsSetup
        initialSchema={initialSchema}
        onSuccess={() => {
          router.push("/");
        }}
        continueLabel={
          credentialsReady ? "Save and return home" : "Continue to analysis setup"
        }
      />
    </>
  );
}
