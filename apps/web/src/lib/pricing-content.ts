/**
 * @file apps/web/src/lib/pricing-content.ts
 * Shared pricing catalog, copy, and helpers for marketing layout options.
 *
 * Model (industry hybrid pattern):
 * - BYOK + flat platform fee covers app infra (compute, storage, orchestration).
 * - Hosted keys is a higher all-in tier with a curated multi-model catalog.
 * - Annual billing is 20% off the monthly rate (billed up front).
 */

export type PricingPlanId = "byok" | "hosted";
export type BillingInterval = "monthly" | "annual";

export interface PricingPlan {
  id: PricingPlanId;
  name: string;
  tagline: string;
  /** Monthly list price in USD cents. */
  monthlyPriceCents: number;
  /** When true, price is provisional until a market rate is finalized. */
  priceProvisional: boolean;
  ctaLabel: string;
  highlights: string[];
  bestFor: string;
}

export const ANNUAL_DISCOUNT_PERCENT = 20;

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

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "byok",
    name: "Bring your own key",
    tagline: "Use your provider keys. We keep the research workspace online.",
    monthlyPriceCents: 300,
    priceProvisional: false,
    ctaLabel: "Start with your keys",
    bestFor: "Traders who already have OpenAI, Anthropic, or another provider account.",
    highlights: [
      "Flat $3/month platform fee — helps cover hosting and app infrastructure",
      "You pay model usage directly to your provider (no token markup from us)",
      "Full multi-agent research pipeline",
      ...PRICING_SHARED_FEATURES.map((feature) => feature.title),
    ],
  },
  {
    id: "hosted",
    name: "Hosted models",
    tagline: "Skip key setup and pick from a wide catalog of models we operate.",
    monthlyPriceCents: 2900,
    priceProvisional: true,
    ctaLabel: "Start with hosted models",
    bestFor: "Anyone who wants model choice without managing API keys.",
    highlights: [
      "Wide array of models to choose from — no provider keys required",
      "We handle routing, quotas, and provider credentials",
      "Full multi-agent research pipeline",
      ...PRICING_SHARED_FEATURES.map((feature) => feature.title),
    ],
  },
];

export const PRICING_PAGE = {
  eyebrow: "Simple pricing",
  title: "Pay for the platform. Choose how models are billed.",
  intro:
    "Most AI tools either hide model costs in a high flat fee or force you to manage keys alone. We offer both: a low infrastructure fee when you bring your own key, or a hosted-models plan when you want a ready-made catalog.",
  annualNote: "Annual billing saves 20% versus paying month to month.",
  provisionalNote:
    "Hosted models pricing is provisional while we finalize a market rate. The checkout flow is scaffolded and not charged yet.",
  infraFraming:
    "The $3 Bring your own key plan is a platform fee — it helps pay for the servers, databases, and orchestration that run TradingAgents. Model tokens still bill to your provider.",
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

export function getPricingPlan(planId: PricingPlanId): PricingPlan {
  const plan = PRICING_PLANS.find((entry) => entry.id === planId);
  if (!plan) {
    throw new Error(`Unknown pricing plan: ${planId}`);
  }
  return plan;
}

/** Annual total in cents after the 20% discount (billed once per year). */
export function annualTotalCents(monthlyPriceCents: number): number {
  return Math.round(monthlyPriceCents * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100));
}

/** Effective monthly rate when paying annually. */
export function annualMonthlyEquivalentCents(monthlyPriceCents: number): number {
  return Math.round(annualTotalCents(monthlyPriceCents) / 12);
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function buildCheckoutHref(planId: PricingPlanId, interval: BillingInterval): string {
  const params = new URLSearchParams({
    plan: planId,
    interval,
  });
  return `/checkout?${params.toString()}`;
}

export function isPricingPlanId(value: string | null | undefined): value is PricingPlanId {
  return value === "byok" || value === "hosted";
}

export function isBillingInterval(value: string | null | undefined): value is BillingInterval {
  return value === "monthly" || value === "annual";
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
