import type { ReactNode } from "react";
import { vi } from "vitest";

export const mockSignOut = vi.fn(async (_opts?: { redirectUrl?: string }) => undefined);

export const mockUseAuth = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  userId: "user_test",
  sessionId: "sess_test",
  getToken: vi.fn(async () => "test-token"),
}));

export const mockUseUser = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: "user_test",
    primaryEmailAddress: { emailAddress: "test@example.com" },
    fullName: "Test User",
  },
}));

export const mockUseClerk = vi.fn(() => ({
  signOut: mockSignOut,
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
  useClerk: () => mockUseClerk(),
  SignedIn: ({ children }: { children: ReactNode }) => children,
  SignedOut: () => null,
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
}));
