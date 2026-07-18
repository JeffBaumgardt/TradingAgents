/**
 * apps/api/src/middleware/public-sessions-mount.test.ts
 *
 * Regression: sub-apps mounted at "/" must not apply use("*", requireUserId())
 * in a way that blocks anonymous GET /sessions/:id share links.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";

describe("public share session mount isolation", () => {
  it("scoped auth middleware does not block /sessions/:id", async () => {
    const requireAuth = () => async (c: {
      json: (body: unknown, status: number) => Response;
    }) => c.json({ error: "Unauthorized" }, 401);

    const credentials = new Hono();
    credentials.use("/credentials", requireAuth());
    credentials.use("/credentials/*", requireAuth());
    credentials.get("/credentials", (c) => c.json({ ok: true }));

    const users = new Hono();
    users.use("/users", requireAuth());
    users.use("/users/*", requireAuth());
    users.get("/users/me", (c) => c.json({ ok: true }));

    const feedback = new Hono();
    feedback.use("/feedback", requireAuth());
    feedback.use("/feedback/*", requireAuth());
    feedback.post("/feedback", (c) => c.json({ ok: true }));

    const sessions = new Hono();
    sessions.get("/sessions/:id", (c) =>
      c.json({ id: c.req.param("id"), public: true }),
    );

    const app = new Hono();
    app.route("/", sessions);
    app.route("/", credentials);
    app.route("/", users);
    app.route("/", feedback);

    const sessionRes = await app.request("/sessions/share-id");
    assert.equal(sessionRes.status, 200);
    assert.deepEqual(await sessionRes.json(), { id: "share-id", public: true });

    assert.equal((await app.request("/credentials")).status, 401);
    assert.equal((await app.request("/users/me")).status, 401);
  });

  it("use('*') on a root-mounted sub-app blocks later public routes", async () => {
    const credentials = new Hono();
    credentials.use("*", async (c) => c.json({ error: "Unauthorized" }, 401));
    credentials.get("/credentials", (c) => c.json({ ok: true }));

    const sessions = new Hono();
    sessions.get("/sessions/:id", (c) => c.json({ public: true }));

    const app = new Hono();
    app.route("/", credentials);
    app.route("/", sessions);

    const sessionRes = await app.request("/sessions/share-id");
    assert.equal(sessionRes.status, 401);
  });
});
