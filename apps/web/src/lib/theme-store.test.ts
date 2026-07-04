/**
 * @file apps/web/src/lib/theme-store.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_THEME_ID } from "./themes";
import { getServerThemeSnapshot, readStoredThemeId } from "./theme-store";

describe("theme-store", () => {
  it("returns the default theme on the server", () => {
    assert.equal(getServerThemeSnapshot(), DEFAULT_THEME_ID);
    assert.equal(readStoredThemeId(), DEFAULT_THEME_ID);
  });
});
