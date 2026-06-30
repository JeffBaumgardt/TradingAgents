# apps/web/Dockerfile
#
# Minimal web placeholder for TradingAgents turborepo.

FROM node:20-alpine
WORKDIR /app
COPY apps/web/package.json ./apps/web/
COPY apps/web/server.js ./apps/web/
WORKDIR /app/apps/web
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
