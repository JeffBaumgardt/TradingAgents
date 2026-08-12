/**
 * @file apps/web/src/lib/privacy-policy-content.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  PRIVACY_CONTACT,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_SECTIONS,
} from "./privacy-policy-content";

describe("privacy-policy-content", () => {
  it("includes GDPR-relevant sections", () => {
    const ids = PRIVACY_POLICY_SECTIONS.map((section) => section.id);
    expect(ids.includes("legal-bases")).toBeTruthy();
    expect(ids.includes("your-rights")).toBeTruthy();
    expect(ids.includes("processors")).toBeTruthy();
    expect(ids.includes("retention")).toBeTruthy();
    expect(ids.includes("transfers")).toBeTruthy();
    expect(ids.includes("cookies-storage")).toBeTruthy();
  });

  it("documents cookies and browser storage explicitly", () => {
    const storageSection = PRIVACY_POLICY_SECTIONS.find(
      (section) => section.id === "cookies-storage",
    );
    expect(storageSection?.items).toBeTruthy();
    const titles = storageSection.items.map((item) => item.title);
    expect(titles.some((title) => title.includes("Clerk"))).toBeTruthy();
    expect(titles.some((title) => title.includes("tradingagents-cookie-ack"))).toBeTruthy();
    expect(titles.some((title) => title.includes("tradingagents-theme"))).toBeTruthy();
  });

  it("provides the privacy contact email", () => {
    expect(PRIVACY_CONTACT_EMAIL).toBe("admin@bugfoot.net");
    expect(PRIVACY_CONTACT.href).toBe("mailto:admin@bugfoot.net");
    expect(PRIVACY_CONTACT.label).toBe("admin@bugfoot.net");
  });
});
