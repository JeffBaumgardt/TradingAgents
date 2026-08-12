/**
 * @file apps/web/src/lib/license-content.test.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  FORK_REPOSITORY,
  LICENSE_SECTIONS,
  NOTICE_TEXT,
  UPSTREAM_PROJECT,
} from "./license-content";

// Vitest runs with cwd = apps/web
const REPO_NOTICE_PATH = path.resolve(process.cwd(), "../../NOTICE");

describe("license-content", () => {
  it("documents upstream Apache 2.0 attribution", () => {
    expect(UPSTREAM_PROJECT.organization).toBe("Tauric Research");
    expect(UPSTREAM_PROJECT.repositoryUrl).toBe("https://github.com/TauricResearch/TradingAgents");
    expect(UPSTREAM_PROJECT.licenseName).toBe("Apache License, Version 2.0");
  });

  it("links to fork LICENSE and NOTICE files for deployed users", () => {
    expect(FORK_REPOSITORY.licenseFileUrl).toMatch(/\/LICENSE$/);
    expect(FORK_REPOSITORY.noticeFileUrl).toMatch(/\/NOTICE$/);
  });

  it("includes required disclosure sections", () => {
    const ids = LICENSE_SECTIONS.map((section) => section.id);
    expect(ids.includes("overview")).toBeTruthy();
    expect(ids.includes("upstream")).toBeTruthy();
    expect(ids.includes("your-rights")).toBeTruthy();
    expect(ids.includes("conditions")).toBeTruthy();
    expect(ids.includes("notice")).toBeTruthy();
    expect(ids.includes("disclaimer")).toBeTruthy();
    expect(ids.includes("repository")).toBeTruthy();
  });

  it("mentions redistribution requirements", () => {
    const conditions = LICENSE_SECTIONS.find((section) => section.id === "conditions");
    expect(conditions?.bullets?.some((bullet) => bullet.includes("NOTICE"))).toBeTruthy();
    expect(conditions?.bullets?.some((bullet) => bullet.includes("Apache License"))).toBeTruthy();
  });

  it("reproduces NOTICE text with upstream and fork attribution", () => {
    expect(NOTICE_TEXT).toMatch(/2024-2026 Tauric Research/);
    expect(NOTICE_TEXT).toMatch(/Jeff Baumgardt/);
    expect(NOTICE_TEXT).toMatch(/TauricResearch\/TradingAgents/);
  });

  it("keeps NOTICE_TEXT in sync with the repository NOTICE file", () => {
    const noticeFromDisk = readFileSync(REPO_NOTICE_PATH, "utf8").replace(/\r\n/g, "\n").trimEnd();
    expect(NOTICE_TEXT.trimEnd()).toBe(noticeFromDisk);
  });
});
