/**
 * @file apps/web/src/lib/license-content.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  FORK_REPOSITORY,
  LICENSE_SECTIONS,
  NOTICE_TEXT,
  UPSTREAM_PROJECT,
} from "./license-content";

const REPO_NOTICE_PATH = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../NOTICE",
);

describe("license-content", () => {
  it("documents upstream Apache 2.0 attribution", () => {
    assert.equal(UPSTREAM_PROJECT.organization, "Tauric Research");
    assert.equal(UPSTREAM_PROJECT.repositoryUrl, "https://github.com/TauricResearch/TradingAgents");
    assert.equal(UPSTREAM_PROJECT.licenseName, "Apache License, Version 2.0");
  });

  it("links to fork LICENSE and NOTICE files for deployed users", () => {
    assert.match(FORK_REPOSITORY.licenseFileUrl, /\/LICENSE$/);
    assert.match(FORK_REPOSITORY.noticeFileUrl, /\/NOTICE$/);
  });

  it("includes required disclosure sections", () => {
    const ids = LICENSE_SECTIONS.map((section) => section.id);
    assert.ok(ids.includes("overview"));
    assert.ok(ids.includes("upstream"));
    assert.ok(ids.includes("your-rights"));
    assert.ok(ids.includes("conditions"));
    assert.ok(ids.includes("notice"));
    assert.ok(ids.includes("disclaimer"));
    assert.ok(ids.includes("repository"));
  });

  it("mentions redistribution requirements", () => {
    const conditions = LICENSE_SECTIONS.find((section) => section.id === "conditions");
    assert.ok(conditions?.bullets?.some((bullet) => bullet.includes("NOTICE")));
    assert.ok(conditions?.bullets?.some((bullet) => bullet.includes("Apache License")));
  });

  it("reproduces NOTICE text with upstream and fork attribution", () => {
    assert.match(NOTICE_TEXT, /2024-2026 Tauric Research/);
    assert.match(NOTICE_TEXT, /Jeff Baumgardt/);
    assert.match(NOTICE_TEXT, /TauricResearch\/TradingAgents/);
  });

  it("keeps NOTICE_TEXT in sync with the repository NOTICE file", () => {
    const noticeFromDisk = readFileSync(REPO_NOTICE_PATH, "utf8").replace(/\r\n/g, "\n").trimEnd();
    assert.equal(NOTICE_TEXT.trimEnd(), noticeFromDisk);
  });
});
