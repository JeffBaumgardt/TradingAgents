/**
 * @file apps/web/src/lib/auth-headers.ts
 * Attach Clerk session tokens to cross-origin API requests.
 */

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setClerkTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

export async function buildAuthHeaders(): Promise<HeadersInit> {
  if (!tokenGetter) {
    return {};
  }

  const token = await tokenGetter();
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
