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

## Why deploys fail (read this first)

Railway was almost certainly doing **two wrong things**:

### 1. Wrong Dockerfile (your build log proves this)

If build logs show `pip install .`, `tradingagents`, and `/opt/venv`, Railway built the **CLI** image from `Dockerfile.cli` at the repo root — **not** the microservice.

The repo used to have a root `Dockerfile` for the Python CLI. Railway auto-picks any root `Dockerfile` unless you override the path. That file is now renamed to **`Dockerfile.cli`** so Railway stops grabbing it by default.

**You want:**

| Service | Dockerfile |
|---------|------------|
| `api` | `apps/api/Dockerfile` (Node, `node dist/index.js`) |
| `agents-service` | `apps/agents-service/Dockerfile` (Python, `uvicorn`) |

### 2. Wrong start command (`pnpm could not be found`)

When Railway imports a pnpm monorepo, it often auto-sets:

```bash
pnpm --filter @tradingagents/api start
```

The production Docker image has **no pnpm** at runtime (only Node or Python). Build succeeds; **deploy** fails when Railway runs that start command.

**Fix:** clear the custom start command or use the `railway.json` config below.

---

## Option A — Fix existing services (recommended)

Do this **per service** in the Railway dashboard.

### Shared settings (both services)

| Setting | Value |
|---------|-------|
| **Root Directory** | *(empty — repo root `/`)* |

Do **not** set Root Directory to `apps/api` or `apps/agents-service` — the Dockerfiles copy `packages/` from the monorepo root.

### `agents-service`

| Setting | Value |
|---------|-------|
| **Config file path** | `/apps/agents-service/railway.json` |
| **Public networking** | Off (private) |

**Or** add a service variable (if not using config-as-code):

```bash
RAILWAY_DOCKERFILE_PATH=apps/agents-service/Dockerfile
```

**Deploy → Custom Start Command:** empty, or:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Variables:**

| Variable | Value |
|----------|-------|
| `PORT` | `8000` |

### `api`

| Setting | Value |
|---------|-------|
| **Config file path** | `/apps/api/railway.json` |
| **Public networking** | On → generate domain |

**Or** service variable:

```bash
RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile
```

**Deploy → Custom Start Command:** empty, or:

```bash
node dist/index.js
```

**Variables:**

| Variable | Example |
|----------|---------|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | From Supabase |
| `SUPABASE_SECRET_KEY` | From Supabase |
| `SUPABASE_JWKS_URL` | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `CLERK_SECRET_KEY` | Same Clerk app as Vercel |
| `AGENTS_SERVICE_URL` | `http://agents-service.railway.internal:8000` |
| `CORS_ORIGIN` | `https://your-app.vercel.app` |

Do **not** set `PORT` — Railway injects it.

---

## Option B — Re-import from Compose

1. Delete the broken Railway services (or create a new project).
2. Drag **`railway.compose.yml`** from the repo root onto the Railway project canvas.
3. Railway creates `api` and `agents-service` with the correct Dockerfiles.
4. Add environment variables from the tables above.

---

## Verify the correct Dockerfile

After redeploying, open **Build Logs**:

**agents-service** should show:

- `FROM python:3.12-slim`
- `pip install -r .../apps/agents-service/requirements.txt`
- `uvicorn`

**api** should show:

- `FROM node:20-alpine`
- `corepack` / `pnpm install` (build stages only)
- final stage `CMD ["node", "dist/index.js"]`

If you still see `pip install .` and `tradingagents`, Railway is **still** using the wrong Dockerfile.

---

## Wire Vercel

```bash
# Vercel
NEXT_PUBLIC_API_URL=https://<api-domain>.up.railway.app

# Railway API (after Vercel deploy)
CORS_ORIGIN=https://<vercel-domain>.vercel.app
```

Health check:

```bash
curl https://<api-domain>.up.railway.app/health
# expect: "agentsService":"ok"
```

---

## Checklist

- [ ] Root Directory is repo root (not `apps/api`)
- [ ] `RAILWAY_DOCKERFILE_PATH` or `railway.json` config file path is set per service
- [ ] Custom Start Command does **not** contain `pnpm`
- [ ] Build logs match the expected Dockerfile (see above)
- [ ] agents-service deployed (private) before api
- [ ] Supabase migrations applied
- [ ] Vercel `NEXT_PUBLIC_API_URL` points at Railway API
