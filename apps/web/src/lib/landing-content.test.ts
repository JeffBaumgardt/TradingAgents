/**
 * @file apps/web/src/lib/landing-content.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LANDING_AGENT_TEAMS, LANDING_HERO } from "./landing-content";

describe("landing-content", () => {
  it("describes the TradingAgents Framework in the hero", () => {
    assert.match(LANDING_HERO.headline, /multi-agent/i);
    assert.match(LANDING_HERO.copy, /real-world trading firms/i);
  });

  it("includes all framework agent teams from the README", () => {
    const slugs = LANDING_AGENT_TEAMS.map((team) => team.slug);
    assert.deepEqual(slugs, [
      "analyst-team",
      "researcher-team",
      "trader-agent",
      "risk-and-portfolio",
    ]);
  });

  it("lists the four analyst roles with README definitions", () => {
    const analystTeam = LANDING_AGENT_TEAMS.find((team) => team.slug === "analyst-team");
    assert.ok(analystTeam?.agents);
    assert.equal(analystTeam.agents.length, 4);

    const names = analystTeam.agents.map((agent) => agent.name);
    assert.deepEqual(names, [
      "Fundamentals Analyst",
      "Sentiment Analyst",
      "News Analyst",
      "Technical Analyst",
    ]);

    assert.match(analystTeam.agents[0].description, /intrinsic values/i);
    assert.match(analystTeam.agents[1].description, /StockTwits/i);
    assert.match(analystTeam.agents[2].description, /macroeconomic/i);
    assert.match(analystTeam.agents[3].description, /MACD and RSI/i);
  });

  it("includes the Portfolio Manager role under risk management", () => {
    const riskTeam = LANDING_AGENT_TEAMS.find((team) => team.slug === "risk-and-portfolio");
    assert.ok(riskTeam);
    assert.match(riskTeam.summary, /Portfolio Manager/i);
    assert.equal(riskTeam.agents?.[0]?.name, "Portfolio Manager");
  });
});
