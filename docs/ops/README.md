# TradingAgents Operations Guide

This directory contains deployment guidance for AWS and production operations teams.

## Services

| Service | Port | Runtime | Purpose |
|---------|------|---------|---------|
| `apps/web` | 3000 | Node.js (Next.js) | Multi-step wizard + live agent streaming UI |
| `apps/api` | 4000 | Node.js (Hono) | Public API gateway, session persistence |
| `apps/agents-service` | 8000 | Python (FastAPI) | LangGraph agent execution, SSE streaming |
| `postgres` | 5432 | PostgreSQL | Optional production database (SQLite in dev) |

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
- `DATABASE_PATH` — SQLite file path (dev), default `./data/tradingagents-api.db`
- `CORS_ORIGIN` — allowed browser origin

### Agents service (`apps/agents-service`)

- `PORT` — default `8000`
- `PYTHONPATH` — must include repository root (`../..` from agents-service)
- LLM keys from `.env` (see `.env.example`)

## Documentation map

- [Architecture](../architecture.md) — system design and Python/TypeScript split
- [API deployment](./apps/api.md)
- [Web deployment](./apps/web.md)
- [Agents service deployment](./apps/agents-service.md)
- [Agent PR loop](./agent-pr-loop.md) — Cursor + GitHub review/fix iteration workflow
