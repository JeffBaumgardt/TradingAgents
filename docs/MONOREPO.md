# TradingAgents Monorepo

Turborepo monorepo wrapping the existing Python LangGraph trading agents with a TypeScript API gateway and Next.js web UI.

## Quick start

```bash
# 1. Python dependencies (repo root + agents-service)
pip install -e .
pip install -r apps/agents-service/requirements.txt

# 2. Environment
cp .env.example .env
# Add at least one LLM provider API key

# 3. JavaScript dependencies
pnpm install

# 4. Web environment
cp apps/web/.env.local.example apps/web/.env.local

# 5. Start all services
pnpm dev
```

| Service | URL | Description |
|---------|-----|-------------|
| Web | http://localhost:3000 | Provider keys → 9-step wizard → streaming run view |
| API | http://localhost:4000 | OpenAPI gateway, session persistence |
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

## Provider credentials (browser session)

1. User enters API keys on the home screen (in-memory only — not saved to DB or localStorage)
2. `POST /config/resolve` returns only providers with supplied credentials
3. Wizard steps 7–8 show filtered providers and models
4. `POST /sessions` includes `providerCredentials`; keys are forwarded to the agents-service for the run only

### Model catalog strategy

| Provider | Source | Notes |
|----------|--------|-------|
| OpenAI, Anthropic, Google, xAI, DeepSeek, Qwen, GLM | **Static** (`model_catalog.py`) | Curated list, manually updated with releases |
| OpenRouter | **Live API** | Fetches `/v1/models` when key provided; falls back to custom ID |
| Ollama | **Live or static** | Queries local `/api/tags` when enabled; static fallback |
| Azure | **User deployment** | Uses deployment name from credentials |

Most providers do not expose a useful “list all models I can use” API without ambiguity, so a maintained static catalog is the default. OpenRouter is the main exception and supports live discovery.

## OpenAPI specification

The canonical API contract lives at `packages/api-types/openapi.yaml`.

Key endpoints:

- `GET /config/credentials/schema` — provider key field definitions
- `POST /config/resolve` — filter config by supplied credentials
- `GET /config/options` — analysts, languages, providers, research depths
- `GET /config/providers/{provider}/models?mode=quick|deep` — model catalog
- `POST /sessions` — start analysis with full CLI-equivalent config
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
