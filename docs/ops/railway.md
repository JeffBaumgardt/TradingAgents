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

### 1. Using Railpack instead of Docker (your latest api log)

If build logs show:

```text
using build driver railpack-v0.30.0
Detected Python
$ pnpm --filter @tradingagents/api build
```

Railway is **not** using `apps/api/Dockerfile`. It auto-detected the Python monorepo root and tried to run pnpm without installing it.

**Fix:** the repo now includes **`/railway.json` at the repo root** with `"builder": "DOCKERFILE"`. Railway loads this by default for the **api** service. Push latest `main` and redeploy.

After fix, api build logs should show `FROM node:20-alpine`, not Railpack.

### 2. Wrong Dockerfile for agents-service (earlier log)

If build logs show `pip install .`, `tradingagents`, and `/opt/venv`, Railway built the **CLI** image — not the microservice.

The CLI Dockerfile is **`Dockerfile.cli`** (renamed so Railway does not auto-select it).

**Fix for agents-service:** set **Config file path** to `/apps/agents-service/railway.json` (required — root config points at the API).

### agents-service deploy shows `pnpm: command not found`

Railway auto-imported this monorepo and set a **Custom Start Command** like:

```bash
pnpm --filter @tradingagents/agents-service start
```

The Python Docker image has **no pnpm**. The build succeeds; deploy fails.

**Fix (agents-service → Settings):**

1. **Deploy → Custom Start Command** → **delete all text** (leave empty), **or** set:
   ```bash
   /usr/local/bin/start-agents-service.sh
   ```
2. **Config-as-code → Config file path** → `/apps/agents-service/railway.json`
3. Redeploy

When the start command is empty, the image **ENTRYPOINT** runs `start-agents-service.sh` (uvicorn).

### `api` deploy shows `pnpm: command not found`

Same issue — clear **Custom Start Command** or set `node dist/index.js`. Root `/railway.json` should set this automatically once pushed.

---

## Option A — Fix existing services (recommended)

Do this **per service** in the Railway dashboard.

### Shared settings (both services)

| Setting | Value |
|---------|-------|
| **Root Directory** | *(empty — repo root `/`)* |

Do **not** set Root Directory to `apps/api` or `apps/agents-service` — the Dockerfiles copy `packages/` from the monorepo root.

### `agents-service`

**Must** override the root config (root `railway.json` is for the API).

| Setting | Value |
|---------|-------|
| **Config file path** | `/apps/agents-service/railway.json` **(required)** |
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

Uses **`/railway.json` at the repo root** automatically (forces Docker, not Railpack).

| Setting | Value |
|---------|-------|
| **Config file path** | `/railway.json` *(default — leave empty or set explicitly)* |
| **Root Directory** | *(empty — repo root)* |
| **Public networking** | On → generate domain |

**Deploy → Custom Start Command:** empty, or `node dist/index.js` (must **not** contain `pnpm`).

Optional override variable:

```bash
RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile
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
