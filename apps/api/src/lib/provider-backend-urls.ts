/**
 * apps/api/src/lib/provider-backend-urls.ts
 *
 * Canonical LLM API base URLs for product providers. Used to ignore
 * client-supplied backendUrl whenever a platform (hosted) API key is in play,
 * so keys cannot be exfiltrated via a malicious proxy / sidecar.
 */

const CANONICAL_BACKEND_URLS: Record<string, string | null> = {
  openai: "https://api.openai.com/v1",
  google: null,
  anthropic: "https://api.anthropic.com/",
  xai: "https://api.x.ai/v1",
};

/** Official vendor endpoint for a provider, or null when the SDK default applies. */
export function canonicalBackendUrlForProvider(providerId: string): string | null {
  const key = providerId.toLowerCase().trim();
  if (!key) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(CANONICAL_BACKEND_URLS, key)) {
    return CANONICAL_BACKEND_URLS[key] ?? null;
  }
  return null;
}

/** True when this provider has a known official endpoint we can pin for hosted runs. */
export function isCanonicalHostedProvider(providerId: string): boolean {
  const key = providerId.toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(CANONICAL_BACKEND_URLS, key);
}
