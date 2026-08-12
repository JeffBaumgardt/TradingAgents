/**
 * @file apps/web/src/lib/landing-content.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  LANDING_AGENT_TEAMS,
  LANDING_HERO,
  LANDING_SUCCESS_STORY,
} from "./landing-content";

describe("landing-content", () => {
  it("describes the TradingAgents Framework in the hero", () => {
    expect(LANDING_HERO.headline).toMatch(/multi-agent|Agents Model/i);
    expect(LANDING_HERO.copy).toMatch(/14-day free trial|free for 14 days/i);
    expect(LANDING_HERO.copy).toMatch(/no credit card/i);
    expect(LANDING_HERO.eyebrow).toMatch(/14-day free trial/i);
    expect(LANDING_HERO.eyebrow).toMatch(/no credit card/i);
  });

  it("includes all framework agent teams from the README", () => {
    const slugs = LANDING_AGENT_TEAMS.map((team) => team.slug);
    expect(slugs).toEqual([
      "analyst-team",
      "researcher-team",
      "trader-agent",
      "risk-and-portfolio",
    ]);
  });

  it("lists the four analyst roles with README definitions", () => {
    const analystTeam = LANDING_AGENT_TEAMS.find((team) => team.slug === "analyst-team");
    expect(analystTeam?.agents).toBeTruthy();
    expect(analystTeam.agents.length).toBe(4);

    const names = analystTeam.agents.map((agent) => agent.name);
    expect(names).toEqual([
      "Fundamentals Analyst",
      "Sentiment Analyst",
      "News Analyst",
      "Technical Analyst",
    ]);

    expect(analystTeam.agents[0].description).toMatch(/intrinsic values/i);
    expect(analystTeam.agents[1].description).toMatch(/StockTwits/i);
    expect(analystTeam.agents[2].description).toMatch(/macroeconomic/i);
    expect(analystTeam.agents[3].description).toMatch(/MACD and RSI/i);
  });

  it("includes the Portfolio Manager role under risk management", () => {
    const riskTeam = LANDING_AGENT_TEAMS.find((team) => team.slug === "risk-and-portfolio");
    expect(riskTeam).toBeTruthy();
    expect(riskTeam.summary).toMatch(/Portfolio Manager/i);
    expect(riskTeam.agents?.[0]?.name).toBe("Portfolio Manager");
  });

  it("frames the SPY success story as a collaborative testimonial arc", () => {
    expect(LANDING_SUCCESS_STORY.eyebrow).toMatch(/SPY/i);
    expect(LANDING_SUCCESS_STORY.headline).toMatch(/one idea/i);
    expect(LANDING_SUCCESS_STORY.quote).toMatch(/0 DTE/i);
    expect(LANDING_SUCCESS_STORY.attribution.name).toMatch(/Alex/i);

    const beatSlugs = LANDING_SUCCESS_STORY.beats.map((beat) => beat.slug);
    expect(beatSlugs).toEqual([
      "opening-thesis",
      "agents-push-back",
      "shared-theory",
    ]);

    expect(LANDING_SUCCESS_STORY.beats[0].copy).toMatch(/Hold/i);
    expect(LANDING_SUCCESS_STORY.beats[1].copy).toMatch(/pushed back|challenge/i);
    expect(LANDING_SUCCESS_STORY.beats[2].copy).toMatch(/Iron Condor/i);

    for (const beat of LANDING_SUCCESS_STORY.beats) {
      expect(beat.imageSrc).toMatch(/^\/images\/landing\/spy-story-/);
      expect(beat.imageAlt.length > 20).toBeTruthy();
    }
  });
});
