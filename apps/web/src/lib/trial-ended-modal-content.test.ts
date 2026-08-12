/**
 * @file apps/web/src/lib/trial-ended-modal-content.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getTrialEndedModalCopy,
  TRIAL_ENDED_MODAL_COPY,
} from "./trial-ended-modal-content";

describe("getTrialEndedModalCopy", () => {
  it("returns trial-over messaging for trial_expired", () => {
    const copy = getTrialEndedModalCopy("trial_expired");
    expect(copy).toBe(TRIAL_ENDED_MODAL_COPY.trial_expired);
    expect(copy.title).toBe("Your free trial is over");
    expect(copy.eyebrow).toBe("Trial ended");
    expect(copy.intro).toMatch(/Thanks for trying TradingAgents/i);
    expect(copy.intro).toMatch(/Subscribe/i);
  });

  it("returns distinct copy for generic subscription_required", () => {
    const copy = getTrialEndedModalCopy("subscription_required");
    expect(copy.title).toBe("Subscribe to keep using TradingAgents");
    expect(copy.title).not.toBe(getTrialEndedModalCopy("trial_expired").title);
  });
});
