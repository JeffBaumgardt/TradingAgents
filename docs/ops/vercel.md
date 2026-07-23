# TradingAgents — Vercel deployment plan

Deploy **`apps/web`** (Next.js) on Vercel. Backends (`apps/api`, `apps/agents-service`) and Postgres run elsewhere — Vercel hosts the UI only.

```text
Browser
  │
  ├── Vercel (apps/web) ── REST + SSE proxy (/api/sessions/*/stream)
  │         │
  │         └── Clerk auth (middleware)
  │
  └── API host (Railway / VPS / Fly) ── apps/api :4000
            │
            ├── agents-service :8000 (internal)
            └── Supabase Postgres
```

---

## 1. Prerequisites (do these first)

| Service | Where | Notes |
|---------|-------|-------|
| **Supabase** | [supabase.com](https://supabase.com) | Run migrations from `packages/supabase` |
| **API + agents** | Railway, Fly.io, or a $5 VPS | See [backend host options](#6-backend-host-api--agents-service) |
| **Clerk** | [dashboard.clerk.com](https://dashboard.clerk.com) | Same app for web + API JWT verification |

The web app will not work until the **API is deployed** and `NEXT_PUBLIC_API_URL` points at it.

---

## 2. Create the Vercel project

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select `TradingAgents`.
2. **Project name:** `tradingagents` (or your preference).
3. **Framework Preset:** Next.js (auto-detected).
4. Expand **Root Directory** → **Edit** → set to **`apps/web`** → **Continue**.

### Required project settings

Open **Settings → General** after the project is created:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/web` |
| **Include source files outside of the Root Directory in the Build Step** | **Enabled** (required for pnpm workspace packages) |
| **Node.js Version** | **22.x** |
| **Package Manager** | **pnpm** (reads `packageManager` from repo root: `pnpm@9.15.0`) |

### Build & development settings

**Settings → Build and Deployment:**

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Build Command** | `cd ../.. && pnpm --filter @trading-agents/web... build` |
| **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
| **Output Directory** | *(leave default — Next.js manages `.next`)* |
| **Development Command** | `next dev --port 3000` *(default)* |

These commands are also checked into `apps/web/vercel.json` so future imports pick them up automatically.

### Optional: skip builds when only Python changes

**Settings → Git → Ignored Build Step:**

```bash
git diff HEAD^ HEAD --quiet -- apps/web packages/api-types packages/utils pnpm-lock.yaml
```

Exit `0` = skip build. Exit `1` = build. Adjust if you add shared packages the web depends on.

---

## 3. Environment variables (Vercel)

**Settings → Environment Variables** for **Production**, **Preview**, and **Development**:

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | **Yes** | Public API origin — include `https://`, no trailing slash |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` / `pk_test_…` | **Yes** | From Clerk → API Keys |
| `CLERK_SECRET_KEY` | `sk_live_…` / `sk_test_…` | **Yes** | Server-side Clerk (middleware, SSE route) |

Copy from `apps/web/.env.local.example`. Do **not** add LLM provider keys here — they stay in the browser session or on the backend.

### Preview vs production API URL

| Strategy | `NEXT_PUBLIC_API_URL` on Preview |
|----------|----------------------------------|
| **Simplest (today)** | Same as production API |
| **Isolated staging** | Separate staging API URL |

---

## Troubleshooting

### `Missing publishableKey` during build

Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` on Vercel for **Production**, **Preview**, and **Development**, then redeploy. The name must include the `NEXT_PUBLIC_` prefix.

### `Failed to parse URL` / `ERR_INVALID_URL` during build

`NEXT_PUBLIC_API_URL` must be a valid absolute URL. Include the protocol:

```bash
NEXT_PUBLIC_API_URL=https://api-production-xxxx.up.railway.app
```

### `Application not found` during build

Railway returns this when `NEXT_PUBLIC_API_URL` points at a domain with no deployed service. The web build must **not** call the API at build time — ensure you have the latest `apps/web` (credentials page uses `force-dynamic`). Even then, set the correct Railway API URL before testing the live app.

### `Module not found: Can't resolve '@tradingagents/api-types'`

Workspace packages export compiled `dist/` output. The web build must compile dependencies first:

```bash
pnpm --filter @trading-agents/web... build
```

The `...` suffix includes `@tradingagents/api-types` and `@tradingagents/utils`. This is set in `apps/web/vercel.json`.

---

## 4. Clerk configuration

In [Clerk Dashboard](https://dashboard.clerk.com) → your application:

### Domains

Add every URL users will sign in from:

- Production: `https://tradingagents.vercel.app` or your custom domain
- Preview: `https://*.vercel.app` (wildcard) or each preview URL
- Local: `http://localhost:3000`

### Paths (defaults work with this repo)

| Path | Route |
|------|-------|
| Sign-in | `/sign-in` |
| Sign-up | `/sign-up` |

Optional env overrides (usually not needed):

```bash
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### API gateway (separate from Vercel)

The **API** (`apps/api`) needs the same Clerk app keys plus Supabase — see `apps/api/.env.example`:

- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET` (if using `/webhooks/clerk` on the API)

Webhook endpoint: `https://<api-host>/webhooks/clerk` (not on Vercel).

---

## 5. Supabase

1. Create or use an existing Supabase project.
2. Apply migrations:

```bash
cd packages/supabase
supabase link --project-ref <your-ref>
supabase db push
```

3. Copy **Project URL**, **publishable key**, and **secret key** into the **API** env (not Vercel web).

---

## 6. Backend host (API + agents-service)

Vercel cannot run the API or Python agents service (long SSE, LangGraph, heavy deps). Co-locate both on one cheap host.

**Recommended for lowest cost today:** one VPS or Railway project with two Docker services.

### API environment (`apps/api`)

| Variable | Example |
|----------|---------|
| `PORT` | `4000` |
| `AGENTS_SERVICE_URL` | `http://agents-service:8000` (internal) |
| `AGENTS_SERVICE_TOKEN` | Shared secret (same value on agents-service) |
| `CORS_ORIGIN` | `https://tradingagents.vercel.app` |
| `SUPABASE_URL` | From Supabase dashboard |
| `SUPABASE_PUBLISHABLE_KEY` | From Supabase dashboard |
| `SUPABASE_SECRET_KEY` | From Supabase dashboard |
| `SUPABASE_JWKS_URL` | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `CLERK_SECRET_KEY` | Same as Vercel |
| `CLERK_PUBLISHABLE_KEY` | Same as Vercel |
| `CREDENTIALS_ENCRYPTION_KEY` | `openssl rand -base64 32` — keep stable across deploys |
| `RESEND_API_KEY` | Resend API key for `POST /feedback` (omit → clear 503) |
| `FEEDBACK_TO_EMAIL` | `jeff@bugfoot.net` (default) |
| `FEEDBACK_FROM_EMAIL` | `TradingAgents Feedback <onboarding@resend.dev>` until domain verified |

### Agents service environment

| Variable | Example |
|----------|---------|
| `PYTHONPATH` | `/app:/app/apps/agents-service` |
| `PORT` | `8000` |
| `AGENTS_SERVICE_TOKEN` | Same shared secret as the API |

Build from `apps/agents-service/Dockerfile` and `apps/api/Dockerfile` (see repo root `docker-compose.yml`).

### CORS

Set `CORS_ORIGIN` on the API to your **exact** Vercel production URL (and preview URL if testing previews against prod API).

---

## 7. SSE streaming and Vercel plan limits

Live analysis uses Server-Sent Events. The browser connects to:

```text
GET /api/sessions/{id}/stream   (Vercel Route Handler — proxies to API with Clerk token)
```

Analysis runs can last **several minutes**.

| Vercel plan | Serverless max duration | Streaming runs |
|-------------|-------------------------|----------------|
| **Hobby** | ~10 seconds | **Will disconnect mid-run** |
| **Pro** | Up to 300s with `maxDuration` | Works for typical runs |

The stream route sets `maxDuration = 300` (see `apps/web/src/app/api/sessions/[sessionId]/stream/route.ts`). **Use Vercel Pro for production**, or accept broken streaming on Hobby.

The upstream API host must also keep connections open (Railway/Fly/VPS — not serverless with short timeouts).

---

## 8. Custom domain (optional)

1. **Vercel:** Settings → Domains → add `app.yourdomain.com`.
2. **Clerk:** add the same domain to allowed origins.
3. **API:** set `CORS_ORIGIN=https://app.yourdomain.com`.
4. Update `NEXT_PUBLIC_API_URL` if the API gets its own domain (e.g. `https://api.yourdomain.com`).

---

## 9. Deploy checklist

### One-time setup

- [ ] Supabase migrations applied
- [ ] API + agents-service deployed and healthy (`GET /health` on API)
- [ ] Vercel project created with Root Directory `apps/web`
- [ ] “Include source files outside Root Directory” enabled
- [ ] All three Vercel env vars set
- [ ] Clerk domains configured
- [ ] API `CORS_ORIGIN` matches Vercel URL

### After each deploy

- [ ] Home page loads config options (API reachable)
- [ ] Sign-in / sign-up works (Clerk)
- [ ] Create session → redirects to `/run/[sessionId]`
- [ ] SSE stream shows agent progress through completion
- [ ] Report loads after run completes

### Local parity

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm dev
```

---

## 10. Future deploy tooling (targets)

| Target | Artifact | Tooling to add |
|--------|----------|----------------|
| **Web** | `apps/web` | `vercel deploy` / Git integration (done via dashboard) |
| **API** | `apps/api/Dockerfile` | Railway/Fly/VPS deploy script |
| **Agents** | `apps/agents-service/Dockerfile` | Same host as API |
| **DB** | `packages/supabase/supabase/migrations` | `supabase db push` in CI |

Suggested repo additions later:

- `scripts/deploy/vercel.sh` — prod/preview deploy wrapper
- `scripts/deploy/backend.sh` — Docker build + push for api/agents
- `.github/workflows/deploy-preview.yml` — preview web on PR

---

## Quick reference — Vercel dashboard

```text
Project: tradingagents
Root Directory: apps/web
Include outside root: ON
Node: 22.x
Package manager: pnpm

Install:  cd ../.. && pnpm install --frozen-lockfile
Build:    cd ../.. && pnpm --filter @trading-agents/web... build

Env:
  NEXT_PUBLIC_API_URL=https://api.yourdomain.com
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
  CLERK_SECRET_KEY=sk_...
```
