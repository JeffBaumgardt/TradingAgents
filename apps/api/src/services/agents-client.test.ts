/**
 * agents-client auth header helpers.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  agentsServiceAuthHeaders,
  getAgentsServiceToken,
} from "./agents-client.js";

const ORIGINAL_TOKEN = process.env.AGENTS_SERVICE_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.AGENTS_SERVICE_TOKEN;
  } else {
    process.env.AGENTS_SERVICE_TOKEN = ORIGINAL_TOKEN;
  }
});

describe("agentsServiceAuthHeaders", () => {
  it("omits Authorization when token is unset", () => {
    delete process.env.AGENTS_SERVICE_TOKEN;
    const headers = agentsServiceAuthHeaders();
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers.Authorization, undefined);
    assert.equal(getAgentsServiceToken(), "");
  });

  it("sends Bearer token when AGENTS_SERVICE_TOKEN is set", () => {
    process.env.AGENTS_SERVICE_TOKEN = "  shared-secret  ";
    const headers = agentsServiceAuthHeaders({ Accept: "text/event-stream" });
    assert.equal(headers.Authorization, "Bearer shared-secret");
    assert.equal(headers.Accept, "text/event-stream");
    assert.equal(getAgentsServiceToken(), "shared-secret");
  });
});
