/**
 * @file apps/web/src/lib/themes.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildThemeBootstrapScript, DEFAULT_THEME_ID } from "./themes";

describe("buildThemeBootstrapScript", () => {
  it("locks the paper theme on marketing routes before reading localStorage", () => {
    const script = buildThemeBootstrapScript();

    assert.match(script, /landingPaths = \[\"\/\", \"\/privacy\"\]/);
    assert.match(script, new RegExp(`document.documentElement.dataset.theme = "${DEFAULT_THEME_ID}"`));
    assert.match(script, /return;/);
  });
});
