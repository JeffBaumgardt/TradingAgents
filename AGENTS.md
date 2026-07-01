# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **TradingAgents** monorepo: an original Python multi-agent LLM
trading framework + CLI, wrapped by a Turborepo web stack.

### Services

| Service | Path | Port | Dev command | Notes |
|---------|------|------|-------------|-------|
| agents-service | `apps/agents-service` | 8000 | `pnpm --filter @tradingagents/agents-service dev` | Python FastAPI; wraps LangGraph engine. Dev script sets `PYTHONPATH=../..` and runs `uvicorn`. |
| api | `apps/api` | 4000 | `pnpm --filter @tradingagents/api dev` | Hono gateway; Supabase Postgres via `@supabase/server`. Proxies to agents-service. |
| web | `apps/web` | 3000 | `pnpm --filter @trading-agents/web dev` | Next.js 14 UI. |

`pnpm dev` (turbo) starts all three at once. Standard commands live in
`README.md`, `docs/MONOREPO.md`, and each `package.json`; don't duplicate them.

### Environment / setup gotchas

- **`~/.local/bin` on PATH**: `pip install -e .` installs console scripts
  (`tradingagents`, `uvicorn`, `ruff`, `pytest`) into `~/.local/bin`. That dir is
  added to `PATH` via `~/.bashrc` during environment setup (persists in the VM
  snapshot). If a script is "not found", either `~/.bashrc` was not sourced or
  invoke via `python3 -m <tool>`.
- Use **`python3`**, not `python` (no `python` alias exists).
- **Env files** (gitignored, persist in snapshot): `cp .env.example .env` and
  `cp apps/web/.env.local.example apps/web/.env.local`. Add at least one LLM
  provider key (e.g. `OPENAI_API_KEY`) to `.env` for real analysis runs.
- **An LLM provider API key is required for a full analysis run.** Without one,
  the pipeline still works end-to-end (session persists, run dispatches, SSE
  streams `agent.status` events) but ends in `run.error`. Core dataflows
  (yfinance market data + indicators, e.g. `python3 test.py`) need **no key**.

### Lint / test / build

- Python: `ruff check .` (lint) and `pytest -q` (tests) from repo root.
- Node: `pnpm lint` / `pnpm build` (turbo; `lint` depends on `^build`).

### Known pre-existing breakage (state of `main` at setup time — re-verify against CI)

CI on `main` is currently **red**; these are repo bugs, not environment issues,
so don't treat them as setup regressions:

- `cli/main.py:561` calls an undefined `get_user_context()` → the interactive
  CLI crashes at step 2, and `pytest` shows 5 failures + `ruff` shows 142 errors
  (matches GitHub CI exactly). `clean-install smoke` is the only green CI job.
- The Next.js **web app fails to compile (HTTP 500)** because
  `apps/web/src/lib/{api-client,api-server,session-display}` are imported but the
  `src/lib/` directory was never committed. The `api` + `agents-service` backends
  are unaffected and fully functional.
