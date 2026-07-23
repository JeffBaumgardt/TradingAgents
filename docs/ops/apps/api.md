# API Gateway Deployment (`apps/api`)

TypeScript Hono service on port 4000. Proxies analysis runs to the Python agents-service and persists sessions/events.

## Recommended AWS deployment: ECS/Fargate

**Why ECS/Fargate over Lambda**

- SSE streaming (`GET /sessions/{id}/stream`) requires long-lived connections
- Session persistence uses Supabase Postgres (`@supabase/server` + `@supabase/supabase-js`)
- Low operational overhead compared to managing EC2

### Architecture

```
Internet → ALB → ECS Service (api) → ECS Service (agents-service)
                      ↓
                 Supabase Postgres
```

### Task definition highlights

- **CPU/Memory**: 0.5 vCPU / 1 GB minimum
- **Health check**: `GET /health`
- **Environment**:
  - `AGENTS_SERVICE_URL=http://agents-service.internal:8000`
  - `AGENTS_SERVICE_TOKEN` — shared secret for `/internal/*` calls (same value on agents-service)
  - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS_URL`
  - `CREDENTIALS_ENCRYPTION_KEY` — 32-byte base64 key for AES-256-GCM encryption of user provider API keys at rest (`openssl rand -base64 32`). Keep stable across deploys; rotating it invalidates stored keys unless you re-encrypt.
  - `CORS_ORIGIN=https://app.example.com`

### Alternative: Lambda + API Gateway

Only suitable if SSE is moved to a dedicated WebSocket or polling endpoint. Not recommended for the current OpenAPI design.

## Scaling

- Horizontal scaling behind ALB for REST endpoints
- SSE connections are sticky; consider dedicated stream replicas or proxy directly to agents-service for high concurrency

## Secrets

Store in AWS Secrets Manager:

- Database credentials
- `CREDENTIALS_ENCRYPTION_KEY` (user API key encryption)
- `AGENTS_SERVICE_TOKEN` (API ↔ agents-service shared secret)

## Monitoring

- ALB 5xx rate on `/health`
- P95 latency on `POST /sessions`
- Active SSE connection count
