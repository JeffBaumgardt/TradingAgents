/**
 * @file apps/web/src/lib/landing-content.ts
 * Marketing copy aligned with the TradingAgents Framework section of the README.
 */

export interface LandingAgent {
  name: string;
  description: string;
}

export interface LandingAgentTeam {
  slug: string;
  title: string;
  summary: string;
  agents?: LandingAgent[];
  imageSrc?: string;
  imageAlt?: string;
}

export const LANDING_HERO = {
  slug: "tradingagents-framework",
  imageSrc: "/images/landing/set-b-hero-advisor-compass.png",
  imageAlt: "Illustration of a glowing compass over stylized market chart mountains",
  headline: "A multi-agent framework built like a real trading firm",
  copy: "TradingAgents mirrors the dynamics of real-world trading firms. Specialized LLM-powered agents—from fundamental and technical analysts to researchers, traders, and risk managers—collaboratively evaluate market conditions and inform research decisions through dynamic discussion.",
} as const;

export const LANDING_FRAMEWORK_INTRO =
  "Our framework decomposes complex trading tasks into specialized roles. Each agent contributes a distinct perspective so you can review structured research—not black-box advice.";

export const LANDING_AGENT_TEAMS: LandingAgentTeam[] = [
  {
    slug: "analyst-team",
    title: "Analyst Team",
    summary:
      "Four specialized analysts gather and interpret market data from fundamentals, sentiment, news, and technicals.",
    imageSrc: "/images/landing/set-b-market-signals.png",
    imageAlt: "AI assistant surrounded by floating market data, news, and chart panels",
    agents: [
      {
        name: "Fundamentals Analyst",
        description:
          "Evaluates company financials and performance metrics, identifying intrinsic values and potential red flags.",
      },
      {
        name: "Sentiment Analyst",
        description:
          "Aggregates news headlines, StockTwits, and Reddit chatter into a single sentiment read to gauge short-term market mood.",
      },
      {
        name: "News Analyst",
        description:
          "Monitors global news and macroeconomic indicators, interpreting the impact of events on market conditions.",
      },
      {
        name: "Technical Analyst",
        description:
          "Utilizes technical indicators (like MACD and RSI) to detect trading patterns and forecast price movements.",
      },
    ],
  },
  {
    slug: "researcher-team",
    title: "Researcher Team",
    summary:
      "Bullish and bearish researchers critically assess analyst insights. Through structured debates, they balance potential gains against inherent risks.",
    imageSrc: "/images/landing/set-b-thesis-builder.png",
    imageAlt: "Modular research blocks assembling into a structured investment thesis",
  },
  {
    slug: "trader-agent",
    title: "Trader Agent",
    summary:
      "Composes reports from the analysts and researchers to make informed trading decisions, determining the timing and magnitude of trades.",
  },
  {
    slug: "risk-and-portfolio",
    title: "Risk Management and Portfolio Manager",
    summary:
      "Continuously evaluates portfolio risk by assessing market volatility, liquidity, and other risk factors. The risk management team evaluates and adjusts trading strategies, providing assessment reports to the Portfolio Manager for final decision.",
    imageSrc: "/images/landing/set-b-watchlist-intelligence.png",
    imageAlt: "Smart watchlist cards floating over a city skyline at dawn",
    agents: [
      {
        name: "Portfolio Manager",
        description:
          "Approves or rejects the transaction proposal. If approved, the order is sent to the simulated exchange and executed.",
      },
    ],
  },
];

export const LANDING_DISCLAIMER =
  "TradingAgents is designed for research purposes. Trading performance may vary based on model choice, temperature, data quality, and other non-deterministic factors. It is not financial, investment, tax, or trading advice.";
