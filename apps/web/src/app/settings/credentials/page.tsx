/**
 * @file apps/web/src/app/settings/credentials/page.tsx
 * Secondary page for entering and editing provider API keys.
 */

import CredentialsPageContent from "@/components/CredentialsPageContent";
import { fetchCredentialsSchemaServer } from "@/lib/api-server";

export default async function CredentialsPage() {
  const initialSchema = await fetchCredentialsSchemaServer();

  return <CredentialsPageContent initialSchema={initialSchema} />;
}
