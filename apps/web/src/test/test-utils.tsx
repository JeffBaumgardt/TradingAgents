import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * Pass-through wrapper — add providers here when a suite needs them.
 * Clerk is mocked in setup/mocks; do not mount a real ClerkProvider.
 */
function AllProviders({ children }: { children: ReactNode }) {
  return children;
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
export { customRender as render };
