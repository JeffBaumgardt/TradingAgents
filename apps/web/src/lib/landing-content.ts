/**
 * @file apps/web/src/lib/landing-content.ts
 * Marketing copy and feature content for the Set B landing page.
 */

export interface LandingFeature {
  slug: string;
  imageSrc: string;
  imageAlt: string;
  headline: string;
  copy: string;
}

export const LANDING_HERO = {
  slug: "research-compass",
  imageSrc: "/images/landing/set-b-hero-advisor-compass.png",
  imageAlt: "Illustration of a glowing compass over stylized market chart mountains",
  headline: "Navigate markets with AI-assisted research",
  copy: "TradingAgents helps you explore opportunities with a research companion built to organize signals—not replace your judgment. Free to start. No credit card. Bring your own AI key.",
} as const;

export const LANDING_FEATURES: LandingFeature[] = [
  {
    slug: "market-signals",
    imageSrc: "/images/landing/set-b-market-signals.png",
    imageAlt: "Friendly AI assistant surrounded by floating market data and chart panels",
    headline: "Detect signals across noisy markets",
    copy: "Pull together market data, news, macro context, and chart behavior into a clearer research picture—before you commit to a thesis.",
  },
  {
    slug: "thesis-builder",
    imageSrc: "/images/landing/set-b-thesis-builder.png",
    imageAlt: "Modular research blocks assembling into a structured investment thesis dashboard",
    headline: "Build stronger investment theses",
    copy: "Break every idea into catalysts, valuation context, risks, sentiment, and supporting evidence with multi-agent collaboration.",
  },
  {
    slug: "smart-watchlists",
    imageSrc: "/images/landing/set-b-watchlist-intelligence.png",
    imageAlt: "Smart watchlist cards floating over a city skyline at dawn",
    headline: "Watchlists that research with you",
    copy: "Track names, surface changes, and keep your research pipeline organized as markets move—without losing context.",
  },
];

export const LANDING_DISCLAIMER =
  "TradingAgents provides AI-generated market research for informational purposes only. It is not financial, investment, tax, or legal advice.";
