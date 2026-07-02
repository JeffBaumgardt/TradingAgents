/**
 * apps/api/src/clerk-client.ts
 * Helpers for verifying Clerk session tokens on cross-origin API requests.
 */

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

export function getClerkAuthorizedParties(): string[] {
  const parties = new Set<string>();

  for (const value of [
    process.env.CORS_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.CLERK_AUTHORIZED_PARTIES?.split(",") ?? []),
  ]) {
    const normalized = value ? normalizeOrigin(value) : null;
    if (normalized) {
      parties.add(normalized);
    }
  }

  return [...parties];
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}
