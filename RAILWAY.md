# Railway backend services

This monorepo deploys **two Docker services** on Railway: `api` and `agents-service`.

**Do not rely on a root `Dockerfile`.** The CLI image lives in `Dockerfile.cli` only.

Full guide: **[docs/ops/railway.md](docs/ops/railway.md)**

## Config files (important)

Railway only auto-loads **`/railway.json` at the repo root** unless you override the path per service.

| Service | Config file | How Railway picks it up |
|---------|-------------|-------------------------|
| **`api`** | `/railway.json` (repo root) | Automatic — forces Docker, not Railpack |
| **`agents-service`** | `/apps/agents-service/railway.json` | **You must set this once** in Settings → Config file path |

### agents-service one-time dashboard step

**Settings → Config-as-code → Config file path:**

```text
/apps/agents-service/railway.json
```

Without this, agents-service inherits the root config and builds the **API Node image** by mistake.

## If you still see Railpack or `pnpm` in build logs

Railway is ignoring Docker config. For the **api** service:

1. Push latest `main` (includes root `railway.json`)
2. **Settings → Config-as-code → Config file path** should be **`/railway.json`** or empty (default)
3. **Settings → Deploy → Custom Start Command** must **not** contain `pnpm`
4. Redeploy

Build logs for **api** should show `FROM node:20-alpine`, not `Railpack` or `pip install`.

## Import shortcut

Drag **`railway.compose.yml`** onto your Railway project canvas to create both services with correct Dockerfiles.
