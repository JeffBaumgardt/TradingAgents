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
  imageSrc: "/images/landing/set-b-market-signals.png",
  imageAlt:
    "AI assistant surrounded by floating market data, news, and chart panels",
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
    imageSrc: "/images/landing/set-b-thesis-builder.png",
    imageAlt:
      "Modular research blocks assembling into a structured investment thesis",
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
    imageSrc: "/images/landing/set-b-bears-bulls-research.png",
    imageAlt:
      "Bear and bull researchers debating market conditions",
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

export interface LandingStoryBeat {
  slug: string;
  label: string;
  title: string;
  copy: string;
  imageSrc: string;
  imageAlt: string;
}

export const LANDING_SUCCESS_STORY = {
  eyebrow: "Customer story · SPY",
  headline: "They walked in with one idea. The agents walked them out with a better one.",
  quote:
    "I thought I wanted a quick directional put after SPY cracked support. The agents verified the breakdown, then pushed back hard on my 0 DTE idea—and kept working with me until we had a defined-risk plan I actually trusted.",
  attribution: {
    name: "Alex R.",
    role: "Independent trader · SPY session, July 2026",
  },
  intro:
    "A real research session on SPY: full multi-agent report first, then a live follow-up conversation when the tape changed. Not a pasted report—a story about challenge, evidence, and a thesis built together.",
  beats: [
    {
      slug: "opening-thesis",
      label: "Day one",
      title: "The opening idea: Hold the consolidation",
      copy: "Alex ran SPY through the full desk. Analysts mapped a choppy range around $748—long-term uptrend intact above the 200 SMA, but short-term momentum flattening. The firm’s call was Hold: respect support, don’t chase the failed breakout.",
      imageSrc: "/images/landing/spy-story-analysts.png",
      imageAlt:
        "Four analyst panels summarizing SPY market, sentiment, news, and fundamentals research",
    },
    {
      slug: "agents-push-back",
      label: "Two days later",
      title: "The tape broke—and the agents pushed back",
      copy: "SPY closed $738.18 and sliced through the 50 SMA on heavy volume. Alex came back worried about chips and a slide past support, floating a 0 DTE 735 put. The agents verified the print, showed the structural damage, then challenged the lottery-ticket trade: time decay would eat the thesis before the market had to prove it.",
      imageSrc: "/images/landing/spy-story-debate.png",
      imageAlt:
        "Bullish and bearish researcher cards debating the SPY Hold thesis after the 50 SMA break",
    },
    {
      slug: "shared-theory",
      label: "Together",
      title: "A new theory, co-authored",
      copy: "Instead of walking away, they kept talking. Out of the debate came a shared range thesis: a July 31 Iron Condor around 735/745, with clear profit targets, breach stops, and defined max loss. Same desk. New theory. Built in conversation—not handed down as a black box.",
      imageSrc: "/images/landing/spy-story-together.png",
      imageAlt:
        "Trader and risk panels showing the shift from a rejected 0 DTE put to a shared Iron Condor plan",
    },
  ] satisfies LandingStoryBeat[],
} as const;

export const LANDING_DISCLAIMER =
  "TradingAgents is designed for research purposes. Trading performance may vary based on model choice, temperature, data quality, and other non-deterministic factors. It is not financial, investment, tax, or trading advice.";
