# Web Frontend Deployment (`apps/web`)

Next.js 14 App Router application on port 3000. Multi-step wizard mirroring the CLI and a live SSE run view with per-agent panels.

## Recommended AWS deployment: AWS Amplify Hosting

Best fit for Next.js SSR and dynamic routes (`/run/[sessionId]`):

- Connect GitHub repo
- Monorepo root: repository root
- App root: `apps/web`
- Build: `pnpm install && pnpm --filter @trading-agents/web build`
- Environment: `NEXT_PUBLIC_API_URL=https://api.example.com`

## Alternative: CloudFront + S3 (static export)

Only if the app is converted to static export (loses dynamic run routes unless client-only):

1. Build: `pnpm --filter @trading-agents/web build`
2. Upload `out/` to S3 bucket
3. CloudFront distribution with HTTPS
4. Set `NEXT_PUBLIC_API_URL` at build time

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Public API gateway URL |
| `PORT` | Dev server port (default 3000) |

## CORS

Ensure `apps/api` sets `CORS_ORIGIN` to the web domain.
