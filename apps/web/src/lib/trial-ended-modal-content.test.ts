/**
 * @file apps/web/src/lib/trial-ended-modal-content.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getTrialEndedModalCopy,
  TRIAL_ENDED_MODAL_COPY,
} from "./trial-ended-modal-content";

describe("getTrialEndedModalCopy", () => {
  it("returns trial-over messaging for trial_expired", () => {
    const copy = getTrialEndedModalCopy("trial_expired");
    assert.equal(copy, TRIAL_ENDED_MODAL_COPY.trial_expired);
    assert.equal(copy.title, "Your free trial is over");
    assert.equal(copy.eyebrow, "Trial ended");
    assert.match(copy.intro, /Thanks for trying TradingAgents/i);
    assert.match(copy.intro, /Subscribe/i);
  });

  it("returns distinct copy for generic subscription_required", () => {
    const copy = getTrialEndedModalCopy("subscription_required");
    assert.equal(copy.title, "Subscribe to keep using TradingAgents");
    assert.notEqual(copy.title, getTrialEndedModalCopy("trial_expired").title);
  });
});
