import type { ReactNode } from "react";
import { forwardRef } from "react";
import { vi } from "vitest";

/** Controllable search params for next/navigation mocks. */
let searchParams = new URLSearchParams();

export function setSearchParams(init?: string | URLSearchParams | Record<string, string>) {
  if (!init) {
    searchParams = new URLSearchParams();
    return;
  }
  if (typeof init === "string") {
    searchParams = new URLSearchParams(init.startsWith("?") ? init.slice(1) : init);
    return;
  }
  if (init instanceof URLSearchParams) {
    searchParams = new URLSearchParams(init);
    return;
  }
  searchParams = new URLSearchParams(init);
}

export function getMockSearchParams(): URLSearchParams {
  return searchParams;
}

export const mockRouterPush = vi.fn();
export const mockRouterReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => getMockSearchParams(),
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: forwardRef<
    HTMLAnchorElement,
    { href: string; children: ReactNode; [key: string]: unknown }
  >(function MockLink({ href, children, ...rest }, ref) {
    return (
      <a ref={ref} href={typeof href === "string" ? href : "#"} {...rest}>
        {children}
      </a>
    );
  }),
}));
