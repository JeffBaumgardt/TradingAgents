/**
 * @file apps/web/src/lib/provider-api-key-link.ts
 * Helpers for rendering provider API key signup links on the credentials screen.
 */

export function resolveProviderApiKeyUrl(
  apiKeyUrl: string | null | undefined,
): string | null {
  if (!apiKeyUrl?.startsWith("https://")) {
    return null;
  }

  return apiKeyUrl;
}

export function getProviderApiKeyLinkLabel(providerId: string): string {
  if (providerId === "azure") {
    return "Set up in Azure portal";
  }

  return "Get an API key";
}

export function getProviderApiKeyLinkHint(providerId: string): string | null {
  if (providerId === "azure") {
    return "Create a resource, then copy the key, endpoint, and deployment name below.";
  }

  return null;
}
