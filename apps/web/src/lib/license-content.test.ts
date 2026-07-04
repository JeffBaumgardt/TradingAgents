/**
 * @file apps/web/src/lib/license-content.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LICENSE_SECTIONS, UPSTREAM_PROJECT } from "./license-content";

describe("license-content", () => {
  it("documents upstream Apache 2.0 attribution", () => {
    assert.equal(UPSTREAM_PROJECT.organization, "Tauric Research");
    assert.equal(UPSTREAM_PROJECT.repositoryUrl, "https://github.com/TauricResearch/TradingAgents");
    assert.equal(UPSTREAM_PROJECT.licenseName, "Apache License, Version 2.0");
  });

  it("includes required disclosure sections", () => {
    const ids = LICENSE_SECTIONS.map((section) => section.id);
    assert.ok(ids.includes("overview"));
    assert.ok(ids.includes("upstream"));
    assert.ok(ids.includes("conditions"));
    assert.ok(ids.includes("disclaimer"));
    assert.ok(ids.includes("repository"));
  });

  it("mentions redistribution requirements", () => {
    const conditions = LICENSE_SECTIONS.find((section) => section.id === "conditions");
    assert.ok(conditions?.bullets?.some((bullet) => bullet.includes("NOTICE")));
    assert.ok(conditions?.bullets?.some((bullet) => bullet.includes("Apache License")));
  });
});
