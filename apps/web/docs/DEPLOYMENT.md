# TradingAgents Web — AWS Deployment

This document outlines a future deployment path for `apps/web` (Next.js) and the
companion API server on AWS using Amplify Hosting and CloudFront.

## Architecture overview

```text
User
  │
  ▼
CloudFront (optional CDN in front of Amplify)
  │
  ├── Static assets + SSR/ISR from Amplify Hosting (apps/web)
  │
  └── /api/* (optional) → ALB → ECS/Fargate API (port 4000)
```

For early deployments, Amplify can host the Next.js app while the Python/FastAPI
backend runs separately (ECS, EC2, or App Runner). Set `NEXT_PUBLIC_API_URL` to
the public API origin.

## Prerequisites

- AWS account with IAM permissions for Amplify, CloudFront, and (optionally) ECS
- Git repository connected to Amplify
- Backend API deployed and reachable from the browser (CORS + SSE headers)

## Environment variables

Configure in Amplify **Environment variables**:

| Variable | Example | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` | Must be browser-accessible |
| `NODE_ENV` | `production` | Set by Amplify during build |

Copy from `apps/web/.env.local.example` for local development.

## Amplify Hosting (Next.js)

1. Create a new Amplify app and connect the monorepo repository.
2. Set the **monorepo app root** to `apps/web`.
3. Build settings (example `amplify.yml` at repo root or in app):

```yaml
version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - corepack enable
            - cd ../.. && pnpm install --frozen-lockfile
            - pnpm --filter @tradingagents/api-types build
            - pnpm --filter @tradingagents/utils build
        build:
          commands:
            - pnpm --filter @trading-agents/web build
      artifacts:
        baseDirectory: .next
        files:
          - "**/*"
      cache:
        paths:
          - node_modules/**/*
          - ../../node_modules/**/*
```

4. Enable **SSR** for Next.js App Router (Amplify Gen 2 or compatible SSR support).
5. Deploy and verify `https://<branch>.<app-id>.amplifyapp.com`.

## CloudFront (optional)

Use CloudFront when you need a custom domain, WAF, or a single hostname for web + API:

1. Create a CloudFront distribution with Amplify as the default origin.
2. Add a behavior `/api/*` pointing to the API load balancer (if proxying API).
3. Enable HTTPS with ACM certificate on your domain.
4. Set cache policies:
   - HTML/SSR: minimal caching or use Amplify-managed behavior
   - `/_next/static/*`: long TTL
   - Do **not** cache `GET /sessions/*/stream` (SSE)

## Backend API requirements

The web app expects:

- `GET /config/options`
- `GET /config/providers/{provider}/models?mode=quick|deep`
- `POST /sessions`
- `GET /sessions/{id}/stream` (SSE)

Ensure the API sets:

- `Access-Control-Allow-Origin` for the Amplify domain
- `Content-Type: text/event-stream` for SSE
- `Cache-Control: no-cache` on stream responses

## SSE and load balancers

Server-Sent Events require:

- ALB idle timeout ≥ analysis duration (or client reconnect logic)
- No response buffering on the stream path
- HTTP/1.1 keep-alive

If using API Gateway, prefer ALB/ECS directly for long-lived SSE connections.

## Secrets

LLM provider API keys belong on the **backend only**. Never expose provider keys
via `NEXT_PUBLIC_*` variables.

## Smoke test checklist

- [ ] Wizard loads config options from production API
- [ ] Session creation redirects to `/run/[sessionId]`
- [ ] SSE stream shows agent progress and reports
- [ ] Stats footer updates during the run
- [ ] Custom domain + HTTPS work end-to-end

## Local parity

```bash
cp apps/web/.env.local.example apps/web/.env.local
pnpm install
pnpm dev:web
```

Web: http://localhost:3000  
API: http://localhost:4000
