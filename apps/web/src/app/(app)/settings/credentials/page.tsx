/**
 * Credentials settings retired — redirect to billing (BYOK removed).
 */

import { redirect } from "next/navigation";

export default function CredentialsSettingsPage() {
  redirect("/settings/billing");
}
