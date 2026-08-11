/**
 * @file apps/web/src/components/CredentialsGate.tsx
 * Retired BYOK gate — product runs use the platform Agents Model only.
 * Kept as a pass-through so older imports do not break.
 */

"use client";

import type { ReactNode } from "react";

interface CredentialsGateProps {
  children: ReactNode;
}

export default function CredentialsGate({ children }: CredentialsGateProps) {
  return <>{children}</>;
}
