/**
 * @file apps/web/src/lib/clerk-appearance.test.ts
 * Guards Clerk appearance wiring against theme token regressions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLERK_THEME_CSS_VARS, clerkAppearance } from "./clerk-appearance";

describe("clerkAppearance", () => {
  it("maps Clerk variables to theme CSS custom properties", () => {
    for (const value of Object.values(clerkAppearance.variables)) {
      if (typeof value !== "string") {
        continue;
      }

      if (value.startsWith("var(")) {
        const token = value.slice(4, -1);
        assert.ok(
          CLERK_THEME_CSS_VARS.includes(token as (typeof CLERK_THEME_CSS_VARS)[number]),
          `Unexpected CSS variable reference: ${value}`,
        );
      }
    }
  });

  it("uses CSS variables for primary form actions and surfaces", () => {
    assert.match(String(clerkAppearance.elements.formButtonPrimary.backgroundColor), /^var\(--clerk-/);
    assert.match(String(clerkAppearance.elements.card.backgroundColor), /^var\(--clerk-/);
    assert.match(String(clerkAppearance.variables.colorBackground), /^var\(--clerk-/);
  });
});
