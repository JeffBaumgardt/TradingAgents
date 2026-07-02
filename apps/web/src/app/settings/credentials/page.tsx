/**
 * @file apps/web/src/app/settings/credentials/page.tsx
 * Secondary page for entering and editing provider API keys.
 */

import type { CredentialsSchemaResponse } from "@tradingagents/api-types";
import CredentialsPageContent from "@/components/CredentialsPageContent";
import { fetchCredentialsSchemaServer } from "@/lib/api-server";

export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  let initialSchema: CredentialsSchemaResponse | undefined;

  try {
    initialSchema = await fetchCredentialsSchemaServer();
  } catch {
    // Schema loads client-side when the API is unreachable at build time.
  }

  return <CredentialsPageContent initialSchema={initialSchema} />;
}
