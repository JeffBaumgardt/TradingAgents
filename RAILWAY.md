# Railway backend services

This monorepo deploys **two Docker services** on Railway: `api` and `agents-service`.

**Do not rely on a root `Dockerfile`.** The CLI image lives in `Dockerfile.cli` only.

Quick setup: see **[docs/ops/railway.md](docs/ops/railway.md)**

Per-service config:

| Service | Config file | Dockerfile |
|---------|-------------|------------|
| `api` | `/apps/api/railway.json` | `apps/api/Dockerfile` |
| `agents-service` | `/apps/agents-service/railway.json` | `apps/agents-service/Dockerfile` |

Or set service variable `RAILWAY_DOCKERFILE_PATH` to the Dockerfile path.

Import shortcut: drag **`railway.compose.yml`** onto your Railway project canvas.
