/**
 * @file apps/web/src/lib/privacy-policy-content.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRIVACY_CONTACT,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_SECTIONS,
} from "./privacy-policy-content";

describe("privacy-policy-content", () => {
  it("includes GDPR-relevant sections", () => {
    const ids = PRIVACY_POLICY_SECTIONS.map((section) => section.id);
    assert.ok(ids.includes("legal-bases"));
    assert.ok(ids.includes("your-rights"));
    assert.ok(ids.includes("processors"));
    assert.ok(ids.includes("retention"));
    assert.ok(ids.includes("transfers"));
    assert.ok(ids.includes("cookies-storage"));
  });

  it("documents cookies and browser storage explicitly", () => {
    const storageSection = PRIVACY_POLICY_SECTIONS.find(
      (section) => section.id === "cookies-storage",
    );
    assert.ok(storageSection?.items);
    const titles = storageSection.items.map((item) => item.title);
    assert.ok(titles.some((title) => title.includes("Clerk")));
    assert.ok(titles.some((title) => title.includes("tradingagents-cookie-ack")));
    assert.ok(titles.some((title) => title.includes("tradingagents-theme")));
  });

  it("provides the privacy contact email", () => {
    assert.equal(PRIVACY_CONTACT_EMAIL, "admin@bugfoot.net");
    assert.equal(PRIVACY_CONTACT.href, "mailto:admin@bugfoot.net");
    assert.equal(PRIVACY_CONTACT.label, "admin@bugfoot.net");
  });
});
