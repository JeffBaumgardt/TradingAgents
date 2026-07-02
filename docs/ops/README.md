# TradingAgents Operations Guide

This directory contains deployment guidance for AWS and production operations teams.

## Services

| Service | Port | Runtime | Purpose |
|---------|------|---------|---------|
| `apps/web` | 3000 | Node.js (Next.js) | Multi-step wizard + live agent streaming UI |
| `apps/api` | 4000 | Node.js (Hono) | Public API gateway, session persistence |
| `apps/agents-service` | 8000 | Python (FastAPI) | LangGraph agent execution, SSE streaming |
| Supabase | — | PostgreSQL | API gateway persistence (hosted or local via Supabase CLI) |

## Local development

```bash
pnpm install
pnpm dev
```

Or with Docker Compose:

```bash
docker compose up --build
```

## Environment variables

### API (`apps/api`)

- `PORT` — default `4000`
- `AGENTS_SERVICE_URL` — default `http://localhost:8000`
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — publishable key for client-facing auth modes
- `SUPABASE_SECRET_KEY` — secret key for `supabaseAdmin` (server-side DB access)
- `SUPABASE_JWKS_URL` — JWKS endpoint for JWT verification (`auth: 'user'`)
- `CORS_ORIGIN` — allowed browser origin

See `apps/api/.env.example` for a full template. Database schema and migrations live in `packages/supabase/supabase/`.

### Agents service (`apps/agents-service`)

- `PORT` — default `8000`
- `PYTHONPATH` — must include repository root (`../..` from agents-service)
- LLM keys from `.env` (see `.env.example`)

## Documentation map

- [Architecture](../architecture.md) — system design and Python/TypeScript split
- **[Vercel deployment (web)](./vercel.md)** — project settings, env vars, Clerk, checklist
- **[Railway deployment (API + agents)](./railway.md)** — Docker services, env vars, troubleshooting
- [API deployment](./apps/api.md)
- [Web deployment (AWS)](./apps/web.md)
- [Agents service deployment](./apps/agents-service.md)
- [Agent PR loop](./agent-pr-loop.md) — Cursor + GitHub review/fix iteration workflow
