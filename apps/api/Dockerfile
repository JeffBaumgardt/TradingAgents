# apps/api/Dockerfile
#
# TypeScript API gateway for TradingAgents.

FROM node:20-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/api-types/package.json ./packages/api-types/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/utils/package.json ./packages/utils/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @tradingagents/api...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# COPY . . replaces apps/api/ and drops workspace node_modules links — relink after source copy.
RUN pnpm install --frozen-lockfile --filter @tradingagents/api...
RUN pnpm --filter @tradingagents/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
