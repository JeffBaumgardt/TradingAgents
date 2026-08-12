/**
 * @file apps/web/src/lib/theme-store.test.ts
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_THEME_ID } from "./themes";
import { getServerThemeSnapshot, readStoredThemeId } from "./theme-store";

describe("theme-store", () => {
  it("returns the default theme on the server", () => {
    expect(getServerThemeSnapshot()).toBe(DEFAULT_THEME_ID);
    expect(readStoredThemeId()).toBe(DEFAULT_THEME_ID);
  });
});
