# apps/agents-service/Dockerfile
#
# Python microservice wrapping LangGraph trading agents.
# PYTHONPATH includes the repository root so tradingagents/ and cli/ are importable.

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml /app/pyproject.toml
COPY tradingagents /app/tradingagents
COPY cli /app/cli
COPY apps/agents-service /app/apps/agents-service

RUN pip install --no-cache-dir -e /app \
    && pip install --no-cache-dir -r /app/apps/agents-service/requirements.txt

ENV PYTHONPATH=/app:/app/apps/agents-service
ENV PORT=8000

WORKDIR /app/apps/agents-service

EXPOSE 8000

COPY apps/agents-service/start.sh /usr/local/bin/start-agents-service.sh
RUN chmod +x /usr/local/bin/start-agents-service.sh

ENTRYPOINT ["/usr/local/bin/start-agents-service.sh"]
