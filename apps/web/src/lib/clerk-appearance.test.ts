/**
 * @file apps/web/src/lib/clerk-appearance.test.ts
 * Guards Clerk appearance wiring against theme token regressions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLERK_THEME_CSS_VARS, clerkAppearance } from "./clerk-appearance";

const CLERK_CSS_VAR_PATTERN = /^var\(--clerk-[a-z0-9-]+\)$/;

/** Hardcoded colors allowed outside the theme token system. */
const ALLOWED_LITERAL_COLORS = new Set(["inherit", "none", "transparent"]);

function collectStringValues(value: unknown, results: string[] = []): string[] {
  if (typeof value === "string") {
    results.push(value);
    return results;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, results);
    }
    return results;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectStringValues(nested, results);
    }
  }

  return results;
}

function isThemeTokenReference(value: string): boolean {
  if (ALLOWED_LITERAL_COLORS.has(value)) {
    return true;
  }

  if (value.startsWith("1px solid ") || value.startsWith("0 0 0 2px color-mix")) {
    return value.includes("var(--clerk-");
  }

  return CLERK_CSS_VAR_PATTERN.test(value);
}

describe("clerkAppearance", () => {
  it("maps Clerk variables to theme CSS custom properties", () => {
    for (const value of Object.values(clerkAppearance.variables)) {
      if (typeof value !== "string") {
        continue;
      }

      if (value.startsWith("var(--clerk-")) {
        const token = value.slice(4, -1);
        assert.ok(
          CLERK_THEME_CSS_VARS.includes(token as (typeof CLERK_THEME_CSS_VARS)[number]),
          `Unexpected CSS variable reference: ${value}`,
        );
      }
    }
  });

  it("uses theme tokens across variables and element styles", () => {
    const values = [
      ...Object.values(clerkAppearance.variables),
      ...collectStringValues(clerkAppearance.elements),
    ];

    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }

      if (value.includes("#") || value.includes("rgba(")) {
        assert.fail(`Hardcoded color found in clerk appearance: ${value}`);
      }

      if (value.includes("var(--clerk-")) {
        assert.match(value, /var\(--clerk-[a-z0-9-]+\)/);
      }
    }
  });

  it("uses CSS variables for primary form actions and surfaces", () => {
    assert.match(String(clerkAppearance.elements.formButtonPrimary.backgroundColor), CLERK_CSS_VAR_PATTERN);
    assert.match(String(clerkAppearance.elements.card.backgroundColor), CLERK_CSS_VAR_PATTERN);
    assert.match(String(clerkAppearance.variables.colorBackground), CLERK_CSS_VAR_PATTERN);
    assert.match(String(clerkAppearance.variables.colorInput), CLERK_CSS_VAR_PATTERN);
  });

  it("hides duplicate Clerk card headings in favor of AuthPageShell", () => {
    assert.equal(clerkAppearance.elements.headerTitle.display, "none");
    assert.equal(clerkAppearance.elements.headerSubtitle.display, "none");
  });

  it("styles OAuth buttons with theme tokens", () => {
    const colorLikeKeys = ["backgroundColor", "color", "border", "borderColor", "boxShadow"];
    const buttonStyles = clerkAppearance.elements.socialButtonsBlockButton as Record<string, unknown>;

    for (const key of colorLikeKeys) {
      const styleValue = buttonStyles[key];
      if (typeof styleValue === "string") {
        assert.ok(isThemeTokenReference(styleValue), `OAuth button ${key} should use theme tokens: ${styleValue}`);
      }

      const hoverStyles = buttonStyles["&:hover"];
      if (hoverStyles && typeof hoverStyles === "object") {
        for (const [hoverKey, hoverValue] of Object.entries(hoverStyles)) {
          if (typeof hoverValue === "string" && colorLikeKeys.includes(hoverKey)) {
            assert.ok(
              isThemeTokenReference(hoverValue),
              `OAuth button hover ${hoverKey} should use theme tokens: ${hoverValue}`,
            );
          }
        }
      }
    }

    assert.match(String(clerkAppearance.elements.socialButtonsBlockButtonText.color), CLERK_CSS_VAR_PATTERN);
  });
});
