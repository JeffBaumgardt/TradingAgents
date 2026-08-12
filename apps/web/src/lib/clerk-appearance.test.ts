/**
 * @file apps/web/src/lib/clerk-appearance.test.ts
 * Guards Clerk appearance wiring against theme token regressions.
 */

import { describe, it, expect } from "vitest";
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
        expect(CLERK_THEME_CSS_VARS.includes(token as (typeof CLERK_THEME_CSS_VARS)[number])).toBeTruthy();
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
        throw new Error(`Hardcoded color found in clerk appearance: ${value}`);
      }

      if (value.includes("var(--clerk-")) {
        expect(value).toMatch(/var\(--clerk-[a-z0-9-]+\)/);
      }
    }
  });

  it("uses CSS variables for primary form actions and surfaces", () => {
    expect(String(clerkAppearance.elements.formButtonPrimary.backgroundColor)).toMatch(CLERK_CSS_VAR_PATTERN);
    expect(String(clerkAppearance.elements.card.backgroundColor)).toMatch(CLERK_CSS_VAR_PATTERN);
    expect(String(clerkAppearance.variables.colorBackground)).toMatch(CLERK_CSS_VAR_PATTERN);
    expect(String(clerkAppearance.variables.colorInput)).toMatch(CLERK_CSS_VAR_PATTERN);
  });

  it("hides duplicate Clerk card headings in favor of AuthPageShell", () => {
    expect(clerkAppearance.elements.headerTitle.display).toBe("none");
    expect(clerkAppearance.elements.headerSubtitle.display).toBe("none");
  });

  it("styles OAuth buttons with theme tokens", () => {
    const colorLikeKeys = ["backgroundColor", "color", "border", "borderColor", "boxShadow"];
    const buttonStyles = clerkAppearance.elements.socialButtonsBlockButton as Record<string, unknown>;

    for (const key of colorLikeKeys) {
      const styleValue = buttonStyles[key];
      if (typeof styleValue === "string") {
        expect(isThemeTokenReference(styleValue)).toBeTruthy();
      }

      const hoverStyles = buttonStyles["&:hover"];
      if (hoverStyles && typeof hoverStyles === "object") {
        for (const [hoverKey, hoverValue] of Object.entries(hoverStyles)) {
          if (typeof hoverValue === "string" && colorLikeKeys.includes(hoverKey)) {
            expect(isThemeTokenReference(hoverValue)).toBeTruthy();
          }
        }
      }
    }

    expect(String(clerkAppearance.elements.socialButtonsBlockButtonText.color)).toMatch(CLERK_CSS_VAR_PATTERN);
  });
});
