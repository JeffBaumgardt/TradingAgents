/**
 * @file apps/web/src/lib/themes.test.ts
 */

import { describe, it, expect } from "vitest";
import { buildThemeBootstrapScript, DEFAULT_THEME_ID } from "./themes";

describe("buildThemeBootstrapScript", () => {
  it("locks the paper theme on marketing routes before reading localStorage", () => {
    const script = buildThemeBootstrapScript();

    expect(script).toMatch(/landingExact = \[\"\/\", \"\/privacy\", \"\/license\"\]/);
    expect(script).toMatch(/landingPrefixes = \[\"\/pricing\", \"\/checkout\", \"\/billing-preview\"\]/);
    expect(script).toMatch(new RegExp(`document.documentElement.dataset.theme = "${DEFAULT_THEME_ID}"`));
    expect(script).toMatch(/return;/);
  });
});
