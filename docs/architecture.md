# TradingAgents Architecture

## Overview

TradingAgents is a turborepo monorepo with a **TypeScript API gateway** and a **Python agents microservice** wrapping the existing LangGraph codebase.

```
┌─────────────┐     REST/SSE      ┌─────────────┐    internal HTTP    ┌──────────────────┐
│  apps/web   │ ───────────────►  │  apps/api   │ ──────────────────► │ agents-service   │
│  (Node/UI)  │                   │  (Hono/TS)  │                     │ (FastAPI/Python) │
└─────────────┘                   └──────┬──────┘                     └────────┬─────────┘
                                         │                                     │
                                         ▼                                     ▼
                                   SQLite/Postgres                      tradingagents/
                                   sessions + events                    cli/ + LangGraph
```

## Why Python cannot be JavaScript (yet)

The core trading agent framework **must remain Python** because it depends on:

| Dependency | Role | JS alternative |
|------------|------|----------------|
| **LangGraph** | Multi-agent graph orchestration, streaming, checkpoints | No mature equivalent |
| **LangChain** | LLM clients, tools, message types | Partial; not drop-in |
| **yfinance** | Market data | Different APIs; not bundled |
| **stockstats / pandas** | Technical indicators | Would require rewrite |
| **langgraph-checkpoint-sqlite** | Crash recovery | Python-specific |

Converting `tradingagents/` to TypeScript would mean reimplementing the entire agent graph, tool integrations, and provider-specific LLM clients. The monorepo therefore uses a **Python microservice** (`apps/agents-service`) that imports the existing packages via `PYTHONPATH=../..`, plus a **TypeScript gateway** for HTTP, persistence, and future web clients.

## Package layout

```
TradingAgents/
├── tradingagents/          # LangGraph agents (Python, unchanged)
├── cli/                    # CLI entry + MessageBuffer stream patterns
├── apps/
│   ├── api/                # Public OpenAPI gateway (port 4000)
│   ├── agents-service/     # Internal Python runner (port 8000)
│   └── web/                # Next.js frontend (port 3000)
├── packages/
│   ├── api-types/          # OpenAPI-aligned TypeScript types
│   ├── utils/              # Shared validation/formatting
│   ├── typescript-config/  # Shared tsconfig
│   └── eslint-config/      # Shared ESLint
└── docs/
    ├── architecture.md     # This file
    └── ops/                # AWS deployment guides
```

## Request flow

1. Client `POST /sessions` → API validates input, stores session, calls `POST /internal/runs`
2. Agents-service starts LangGraph in a background thread
3. Client `GET /sessions/{id}/stream` → API proxies SSE from agents-service and persists events
4. On `run.completed`, API fetches report and marks session complete
5. Client `GET /sessions/{id}/report` → returns markdown + structured sections

## Stream processing

SSE events are produced by `apps/agents-service/stream_processor.py`, extracted from `cli/main.py` (lines 1093–1190). It reuses the same MessageBuffer patterns:

- Message deduplication by LangChain message ID
- Analyst status transitions from report sections
- Research, trading, and risk debate state handling
- Stats callbacks from `cli/stats_handler.py`

## Configuration

Config options (`GET /config/options`) mirror `cli/utils.py` and `tradingagents/llm_clients/model_catalog.py`:

- Analysts: market, social, news, fundamentals
- Research depth: 1, 3, 5 debate rounds
- Languages: English, Chinese, Japanese, …
- LLM providers: OpenAI, Google, Anthropic, xAI, DeepSeek, Qwen, GLM, OpenRouter, Azure, Ollama

## Development vs production

| Concern | Development | Production |
|---------|-------------|------------|
| API database | Supabase Postgres (`packages/supabase`; local via Supabase CLI) | Supabase Postgres |
| Agents storage | In-memory run manager | Redis queue + EFS checkpoints |
| Secrets | `.env` file | AWS Secrets Manager |
| Web | Next.js on Amplify or ECS + ALB |

## PYTHONPATH requirement

The agents-service must include the repository root on `PYTHONPATH` so imports work:

```bash
cd apps/agents-service
PYTHONPATH=../.. uvicorn main:app --reload --port 8000
```

Docker sets `PYTHONPATH=/app:/app/apps/agents-service`.
