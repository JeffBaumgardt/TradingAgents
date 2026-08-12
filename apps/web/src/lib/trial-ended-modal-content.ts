/**
 * @file apps/web/src/lib/trial-ended-modal-content.ts
 * Copy for the non-closeable paywall shown when access requires a paid plan.
 */

export type TrialEndedModalVariant = "trial_expired" | "subscription_required";

export interface TrialEndedModalCopy {
  eyebrow: string;
  title: string;
  intro: string;
  benefitsHeading: string;
  /** Extra benefit shown after shared pricing features (except free-trial bullet). */
  continuityBenefit: {
    title: string;
    description: string;
  };
  subscribeProLabel: string;
  subscribeStandardLabel: string;
  comparePlansLabel: string;
  signOutLabel: string;
  annualNote: string;
}

export const TRIAL_ENDED_MODAL_COPY: Record<TrialEndedModalVariant, TrialEndedModalCopy> = {
  trial_expired: {
    eyebrow: "Trial ended",
    title: "Your free trial is over",
    intro:
      "Thanks for trying TradingAgents. Subscribe to continue multi-agent research on our managed Agents Model — no provider keys, clear credit pools, and the same pipeline you already used.",
    benefitsHeading: "Why subscribe",
    continuityBenefit: {
      title: "Keep building on what you already ran",
      description:
        "Past reports stay stored on your account. Subscribe again to start new runs and keep researching with the same specialist analyst team.",
    },
    subscribeProLabel: "Subscribe to Pro",
    subscribeStandardLabel: "Subscribe to Standard",
    comparePlansLabel: "Compare plans in detail",
    signOutLabel: "Sign out",
    annualNote:
      "Annual billing saves 20%. You only enter a payment method at checkout — your trial never charged a card.",
  },
  subscription_required: {
    eyebrow: "Subscription required",
    title: "Subscribe to keep using TradingAgents",
    intro:
      "An active Standard or Pro plan is required to run new analyses. Subscribe to unlock the full research pipeline on our managed Agents Model.",
    benefitsHeading: "Why subscribe",
    continuityBenefit: {
      title: "Keep building on what you already ran",
      description:
        "Past reports stay stored on your account. Subscribe again to start new runs and keep researching with the same specialist analyst team.",
    },
    subscribeProLabel: "Subscribe to Pro",
    subscribeStandardLabel: "Subscribe to Standard",
    comparePlansLabel: "Compare plans in detail",
    signOutLabel: "Sign out",
    annualNote:
      "Annual billing saves 20%. You only enter a payment method at checkout — your trial never charged a card.",
  },
};

export function getTrialEndedModalCopy(variant: TrialEndedModalVariant): TrialEndedModalCopy {
  return TRIAL_ENDED_MODAL_COPY[variant];
}
