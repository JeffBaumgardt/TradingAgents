# TradingAgents Monorepo

Turborepo monorepo wrapping the existing Python LangGraph trading agents with a TypeScript API gateway and Next.js web UI.

## Quick start

```bash
# 1. Python dependencies (repo root + agents-service)
pip install -e .
pip install -r apps/agents-service/requirements.txt

# 2. Environment
cp .env.example .env
# Platform Agents Model key is injected server-side (ANTHROPIC / platform_api_keys).
# Local full runs still need a configured platform Anthropic key.

# 3. JavaScript dependencies
pnpm install

# 4. Web environment
cp apps/web/.env.local.example apps/web/.env.local

# 5. Start all services
pnpm dev
```

| Service | URL | Description |
|---------|-----|-------------|
| Web | http://localhost:3000 | Subscription/trial gate → wizard → streaming run view |
| API | http://localhost:4000 | OpenAPI gateway, sessions, billing |
| Agents | http://localhost:8000 | Python LangGraph execution (internal) |

## Project layout

```
apps/
  api/              TypeScript Hono API (port 4000)
  web/              Next.js frontend (port 3000)
  agents-service/   Python FastAPI wrapper (port 8000)
packages/
  api-types/        OpenAPI spec + TypeScript types
  utils/            Shared validation and formatting
  typescript-config/
  eslint-config/
tradingagents/      Original Python agent library (unchanged)
cli/                Original CLI (still works independently)
docs/
  architecture.md   System design
  ops/              AWS deployment guides per app
  MONOREPO.md       This file
```

## Product inference (Agents Model)

There is no BYOK and no multi-provider product catalog on Standard/Pro.

1. User signs in and starts a free Pro trial (or subscribes to Standard/Pro).
2. Platform Anthropic key is loaded server-side from `platform_api_keys`.
3. Every product run forces `llmProvider=anthropic` and `thinkLlm=claude-sonnet-5` (Agents Model).
4. Compute credits are metered against the active plan allowance.

See [PLATFORM_API_KEYS_AND_CREDITS.md](./PLATFORM_API_KEYS_AND_CREDITS.md) for credit math and ops details.

The CLI and local library still support additional providers for development; the hosted web product does not.

## OpenAPI specification

The canonical API contract lives at `packages/api-types/openapi.yaml`.

Key endpoints:

- `POST /config/resolve` — product config enrichment for active subscribers
- `GET /config/options` — analysts, languages, providers, research depths
- `GET /config/providers/{provider}/models?mode=quick|deep` — model catalog
- `POST /billing/trial/start` — one free trial per account
- `POST /sessions` — start analysis on Agents Model (subscription required)
- `GET /sessions/{id}/stream` — SSE events (`run.started`, `agent.status`, `message`, `tool.call`, `report.section`, `stats`, `run.completed`, `run.error`)
- `GET /sessions/{id}/report` — final markdown report + rating

## Why Python remains

The core agent engine (`tradingagents/`) cannot be converted to JavaScript without reimplementing LangGraph, LangChain tool integrations, yfinance, and pandas-based indicators. See [architecture.md](./architecture.md) for details.

The TypeScript layer handles HTTP, persistence, and the web UI. The Python `agents-service` runs the existing graph unchanged.

## Docker Compose

```bash
# Full stack (web + api + agents-service)
docker compose up --build

# Original CLI (unchanged)
docker compose run --rm tradingagents

# Optional Postgres for future production parity
docker compose --profile postgres up
```

## Individual service commands

```bash
pnpm --filter @tradingagents/api dev
pnpm --filter @trading-agents/web dev
pnpm --filter @tradingagents/agents-service dev
```

## Operations

See [docs/ops/README.md](./ops/README.md) for AWS deployment guidance per app.
