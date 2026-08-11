/**
 * @file apps/web/src/lib/pricing-content.ts
 * Marketing copy and helpers for pricing layouts.
 *
 * Plan cents / names come from `@tradingagents/api-types` (BILLING_CATALOG) so
 * the API and UI cannot drift.
 *
 * Model:
 * - Standard ($9) — Agents Model, 1/3 Pro credits, 7-day report messaging, no share
 * - Pro ($19) — Agents Model, full credits, share + full history
 * - Both include a 14-day no-card free trial (default: Pro)
 * - Annual billing is 20% off the monthly rate (billed up front)
 */

import {
  BILLING_ANNUAL_DISCOUNT_PERCENT,
  BILLING_CATALOG,
  billingAnnualMonthlyEquivalentCents,
  billingAnnualTotalCents,
  getBillingPlan,
  PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
  TRIAL_DAYS,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@tradingagents/api-types";
import { formatComputeCredits } from "@/lib/billing-display";

export type { BillingInterval, BillingPlanId };

export interface PricingPlan {
  id: BillingPlanId;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  priceProvisional: boolean;
  ctaLabel: string;
  highlights: string[];
  bestFor: string;
  recommended?: boolean;
}

export const ANNUAL_DISCOUNT_PERCENT = BILLING_ANNUAL_DISCOUNT_PERCENT;

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const STANDARD_CREDIT_LABEL = formatComputeCredits(
  STANDARD_MONTHLY_COMPUTE_CREDIT_ALLOWANCE,
);
const PRO_CREDIT_LABEL = formatComputeCredits(PRO_MONTHLY_COMPUTE_CREDIT_ALLOWANCE);

export const PRICING_SHARED_FEATURES = [
  {
    title: "Agents Model included",
    description:
      "Every run uses our managed Claude Sonnet Agents Model — no provider keys to set up.",
  },
  {
    title: "Multi-agent research pipeline",
    description: "Analysts, debate, risk, and portfolio management in one research run.",
  },
  {
    title: "14-day free trial",
    description: `No credit card required. Credits count during the trial (${TRIAL_DAYS} days).`,
  },
] as const;

const PLAN_MARKETING: Record<
  BillingPlanId,
  Pick<PricingPlan, "tagline" | "ctaLabel" | "bestFor" | "highlights" | "recommended">
> = {
  standard: {
    tagline: "Full research pipeline on a lighter monthly credit pool.",
    ctaLabel: "Start free trial",
    bestFor: "Traders getting started with multi-agent research and tighter budgets.",
    highlights: [
      `${STANDARD_CREDIT_LABEL} compute credits per month (1/3 of Pro)`,
      "Agents Model (Claude Sonnet) — managed for you",
      "Research depth + efficiency controls",
      "Reports kept visible for 7 days (upgrade for full history)",
      "Sharing by link available on Pro",
    ],
  },
  pro: {
    tagline: "Full credit pool, report sharing, and long-term history.",
    ctaLabel: "Start free Pro trial",
    bestFor: "Active traders who share reports and run deeper research regularly.",
    recommended: true,
    highlights: [
      `${PRO_CREDIT_LABEL} compute credits per month`,
      "Agents Model (Claude Sonnet) — managed for you",
      "Share finished reports by link",
      "Full report history (no 7-day limit)",
      "Research depth + efficiency controls",
    ],
  },
};

export const PRICING_PLANS: PricingPlan[] = BILLING_CATALOG.map((plan) => ({
  id: plan.id,
  name: plan.name,
  monthlyPriceCents: plan.monthlyPriceCents,
  priceProvisional: plan.priceProvisional,
  ...PLAN_MARKETING[plan.id],
}));

export const PRICING_PAGE = {
  eyebrow: "Simple pricing",
  title: "One Agents Model. Two clear plans.",
  intro:
    "Every subscription runs on our managed Agents Model (Claude Sonnet). Pick Standard for a lighter credit pool, or Pro for full credits, sharing, and long-term report history. Both include a 14-day free trial — no credit card required.",
  annualNote: `Annual billing saves ${ANNUAL_DISCOUNT_PERCENT}% versus paying month to month.`,
  provisionalNote:
    "Credits meter against Agents Model token usage. Payments run through Stripe after your free trial — we only ask for a card when you subscribe.",
  infraFraming: `Free trial lasts ${TRIAL_DAYS} days on either plan (we default new users to Pro). Trial credits count toward your monthly allowance; when the trial ends, subscribe with Stripe to keep running analyses.`,
} as const;

export function getPricingPlan(planId: BillingPlanId): PricingPlan {
  const plan = PRICING_PLANS.find((entry) => entry.id === planId);
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return plan;
}

export function getPlanDisplayPrice(
  planId: BillingPlanId,
  interval: BillingInterval,
): { label: string; sublabel: string | null } {
  const plan = getBillingPlan(planId);
  if (interval === "monthly") {
    return {
      label: formatUsdFromCents(plan.monthlyPriceCents),
      sublabel: "per month",
    };
  }
  const monthly = billingAnnualMonthlyEquivalentCents(plan.monthlyPriceCents);
  const annual = billingAnnualTotalCents(plan.monthlyPriceCents);
  return {
    label: formatUsdFromCents(monthly),
    sublabel: `per month, billed ${formatUsdFromCents(annual)} yearly`,
  };
}

export function annualTotalCents(monthlyPriceCents: number): number {
  return billingAnnualTotalCents(monthlyPriceCents);
}

export function annualMonthlyEquivalentCents(monthlyPriceCents: number): number {
  return billingAnnualMonthlyEquivalentCents(monthlyPriceCents);
}

export function displayPriceCents(
  plan: { monthlyPriceCents: number },
  interval: BillingInterval,
): number {
  if (interval === "monthly") {
    return plan.monthlyPriceCents;
  }
  return annualMonthlyEquivalentCents(plan.monthlyPriceCents);
}

export function displayPriceCaption(
  plan: { monthlyPriceCents: number },
  interval: BillingInterval,
): string {
  if (interval === "monthly") {
    return "Billed monthly";
  }
  return `Billed yearly (${formatUsdFromCents(annualTotalCents(plan.monthlyPriceCents))}/yr)`;
}

export function buildCheckoutHref(
  planId: BillingPlanId,
  interval: BillingInterval,
): string {
  return `/checkout?plan=${encodeURIComponent(planId)}&interval=${encodeURIComponent(interval)}`;
}

export function isPricingPlanId(
  value: string | null | undefined,
): value is BillingPlanId {
  return isBillingPlanId(value);
}

export { isBillingInterval, isBillingPlanId, TRIAL_DAYS };
