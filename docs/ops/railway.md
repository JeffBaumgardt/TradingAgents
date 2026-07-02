# TradingAgents — Railway deployment (API + agents-service)

Deploy **`apps/api`** and **`apps/agents-service`** as two services in one Railway project. The web app stays on Vercel.

```text
Vercel (web) ──public──▶ Railway API (:PORT)
                              │
                              └──private──▶ agents-service (:PORT)
                                              │
                                              └──▶ Supabase Postgres
```

---

## 1. Create the Railway project

1. [railway.app/new](https://railway.app/new) → **Deploy from GitHub** → `TradingAgents`.
2. Add **two services** from the same repo (do not use Railway's default Nixpacks Node start command).

---

## 2. Service: `agents-service` (deploy first)

### Dashboard settings

| Setting | Value |
|---------|-------|
| **Service name** | `agents-service` |
| **Root Directory** | *(empty — repo root)* |
| **Config file path** | `apps/agents-service/railway.toml` |
| **Builder** | Dockerfile *(set by config file)* |
| **Public networking** | **Off** (private only) |

### Environment variables

| Variable | Value |
|----------|-------|
| `PORT` | `8000` |
| `PYTHONPATH` | `/app:/app/apps/agents-service` *(already in Dockerfile)* |

LLM keys (`OPENAI_API_KEY`, etc.) are optional — users store credentials via the web app.

### Health check

`GET /health` → `{"status":"ok","service":"tradingagents-agents-service"}`

---

## 3. Service: `api`

### Dashboard settings

| Setting | Value |
|---------|-------|
| **Service name** | `api` |
| **Root Directory** | *(empty — repo root)* |
| **Config file path** | `apps/api/railway.toml` |
| **Builder** | Dockerfile *(set by config file)* |
| **Custom Start Command** | **Leave empty** — config sets `node dist/index.js` |
| **Public networking** | **On** → generate domain |

> **Important:** If you previously set a start command like `pnpm start` or `pnpm --filter @tradingagents/api start`, **remove it**. The production Docker image does not include `pnpm`; runtime is `node dist/index.js` only.

### Environment variables

| Variable | Example |
|----------|---------|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | From Supabase dashboard |
| `SUPABASE_SECRET_KEY` | From Supabase dashboard |
| `SUPABASE_JWKS_URL` | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `CLERK_SECRET_KEY` | Same Clerk app as Vercel |
| `AGENTS_SERVICE_URL` | `http://agents-service.railway.internal:8000` |
| `CORS_ORIGIN` | `https://your-app.vercel.app` *(update after Vercel deploy)* |

Do **not** set `PORT` manually — Railway injects it; the API reads `process.env.PORT`.

Optional:

| Variable | When |
|----------|------|
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk webhooks → `https://<api-domain>/webhooks/clerk` |
| `CLERK_JWT_KEY` | Faster JWT verification |

### Health check

`GET /health` → `agentsService: "ok"` when agents-service is reachable.

---

## 4. Wire Vercel

Set on Vercel:

```bash
NEXT_PUBLIC_API_URL=https://<api-service-domain>.up.railway.app
```

Then set on Railway API:

```bash
CORS_ORIGIN=https://<vercel-domain>.vercel.app
```

---

## 5. Troubleshooting

### `The executable pnpm could not be found` (deploy phase)

Railway is trying to **start** the container with `pnpm`, not build with Docker.

**Fix:**

1. **Settings → Deploy → Custom Start Command** → clear it (empty).
2. Set **Config file path** to `apps/api/railway.toml`.
3. Confirm **Builder** is **Dockerfile**, not Nixpacks.
4. Redeploy.

### `agentsService: "unreachable"` on `/health`

- Both services in the **same Railway project/environment**.
- `AGENTS_SERVICE_URL=http://agents-service.railway.internal:8000` (match your service name).
- agents-service is deployed and healthy.

### Docker build fails on `pnpm install`

The Dockerfile enables pnpm via Corepack in the **build** stages only. Pull latest `apps/api/Dockerfile` from the repo.

### Wrong build context

**Root Directory** must be the **repo root**, not `apps/api`. The Dockerfile copies `packages/` and workspace files from the monorepo root.

---

## 6. Checklist

- [ ] Supabase migrations applied
- [ ] agents-service deployed (private)
- [ ] api deployed with public domain
- [ ] `GET https://<api>/health` returns `agentsService: "ok"`
- [ ] Vercel `NEXT_PUBLIC_API_URL` points at Railway API
- [ ] Railway `CORS_ORIGIN` matches Vercel URL
