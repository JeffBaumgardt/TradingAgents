/**
 * @file apps/web/src/lib/pricing-content.ts
 * Marketing copy and helpers for pricing layouts.
 *
 * Plan cents / names come from `@tradingagents/api-types` (BILLING_CATALOG) so
 * the API and UI cannot drift.
 *
 * Model (industry hybrid pattern):
 * - BYOK + flat platform fee covers app infra (compute, storage, orchestration).
 * - Hosted keys is a higher all-in tier with a curated multi-model catalog.
 * - Annual billing is 20% off the monthly rate (billed up front).
 */

import {
  BILLING_ANNUAL_DISCOUNT_PERCENT,
  BILLING_CATALOG,
  billingAnnualMonthlyEquivalentCents,
  billingAnnualTotalCents,
  getBillingPlan,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@tradingagents/api-types";

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

/** Shared product capabilities available on every paid plan. */
export const PRICING_SHARED_FEATURES = [
  {
    title: "Detailed charts",
    description: "Richer technical and market visuals inside every research run.",
  },
  {
    title: "Share reports by link",
    description: "Send a direct link so collaborators can review a completed report.",
  },
  {
    title: "In-product feedback",
    description: "Tell us what to improve without leaving the workspace.",
  },
] as const;

const BYOK_MONTHLY_LABEL = formatUsdFromCents(getBillingPlan("byok").monthlyPriceCents);

const PLAN_MARKETING: Record<
  BillingPlanId,
  Pick<PricingPlan, "tagline" | "ctaLabel" | "bestFor" | "highlights">
> = {
  byok: {
    tagline: "Use your provider keys. We keep the research workspace online.",
    ctaLabel: "Start with your keys",
    bestFor: "Traders who already have OpenAI, Anthropic, or another provider account.",
    highlights: [
      `Flat ${BYOK_MONTHLY_LABEL}/month platform fee — helps cover hosting and app infrastructure`,
      "You pay model usage directly to your provider (no token markup from us)",
      "Full multi-agent research pipeline",
      ...PRICING_SHARED_FEATURES.map((feature) => feature.title),
    ],
  },
  hosted: {
    tagline: "Skip key setup and pick from a wide catalog of models we operate.",
    ctaLabel: "Start with hosted models",
    bestFor: "Anyone who wants model choice without managing API keys.",
    highlights: [
      "Wide array of models to choose from — no provider keys required",
      "We handle routing, quotas, and provider credentials",
      "Full multi-agent research pipeline",
      ...PRICING_SHARED_FEATURES.map((feature) => feature.title),
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
  title: "Pay for the platform. Choose how models are billed.",
  intro:
    "Most AI tools either hide model costs in a high flat fee or force you to manage keys alone. We offer both: a low infrastructure fee when you bring your own key, or a hosted-models plan when you want a ready-made catalog.",
  annualNote: `Annual billing saves ${ANNUAL_DISCOUNT_PERCENT}% versus paying month to month.`,
  provisionalNote:
    "Hosted models pricing is provisional while we finalize a market rate. The checkout flow is scaffolded and not charged yet.",
  infraFraming: `The ${BYOK_MONTHLY_LABEL} Bring your own key plan is a platform fee — it helps pay for the servers, databases, and orchestration that run TradingAgents. Model tokens still bill to your provider.`,
} as const;

export const PRICING_LAYOUT_OPTIONS = [
  {
    id: "a",
    href: "/pricing/a",
    name: "Layout A — Dual cards",
    summary: "Classic SaaS twin cards with a monthly / annual toggle and equal visual weight.",
  },
  {
    id: "b",
    href: "/pricing/b",
    name: "Layout B — Comparison matrix",
    summary: "Feature table with plan columns — strong for side-by-side capability scanning.",
  },
  {
    id: "c",
    href: "/pricing/c",
    name: "Layout C — Choose your path",
    summary: "Editorial split paths with marketing imagery — more story, fewer cards.",
  },
] as const;

export function getPricingPlan(planId: BillingPlanId): PricingPlan {
  const catalog = getBillingPlan(planId);
  return {
    id: catalog.id,
    name: catalog.name,
    monthlyPriceCents: catalog.monthlyPriceCents,
    priceProvisional: catalog.priceProvisional,
    ...PLAN_MARKETING[planId],
  };
}

export const annualTotalCents = billingAnnualTotalCents;
export const annualMonthlyEquivalentCents = billingAnnualMonthlyEquivalentCents;

export function buildCheckoutHref(planId: BillingPlanId, interval: BillingInterval): string {
  const params = new URLSearchParams({
    plan: planId,
    interval,
  });
  return `/checkout?${params.toString()}`;
}

export { isBillingInterval, isBillingPlanId };

export function isPricingPlanId(value: string | null | undefined): value is BillingPlanId {
  return isBillingPlanId(value);
}

export function displayPriceCents(plan: PricingPlan, interval: BillingInterval): number {
  if (interval === "annual") {
    return annualMonthlyEquivalentCents(plan.monthlyPriceCents);
  }
  return plan.monthlyPriceCents;
}

export function displayPriceCaption(plan: PricingPlan, interval: BillingInterval): string {
  if (interval === "annual") {
    return `${formatUsdFromCents(annualTotalCents(plan.monthlyPriceCents))} billed yearly`;
  }
  return "Billed monthly";
}
