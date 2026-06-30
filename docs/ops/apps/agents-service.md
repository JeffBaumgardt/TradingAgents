# Agents Service Deployment (`apps/agents-service`)

Python FastAPI service on port 8000. Wraps LangGraph trading agents from the repository root.

## Recommended AWS deployment: ECS/Fargate

**Why ECS/Fargate**

- Long-running LangGraph executions (minutes, not milliseconds)
- Requires Python 3.10+ with native dependencies (pandas, yfinance)
- Needs LLM API keys and optional checkpoint storage
- SSE streaming for run progress

**Why not Lambda**

- 15-minute timeout may be insufficient for deep research runs
- Large Python dependencies exceed comfortable Lambda package sizes
- LangGraph checkpoint/resume uses local/SQLite storage patterns

### Task definition highlights

- **Image**: built from `apps/agents-service/Dockerfile`
- **CPU/Memory**: 2 vCPU / 4 GB recommended for deep runs
- **Environment**:
  - `PYTHONPATH=/app:/app/apps/agents-service`
  - LLM keys from Secrets Manager (mapped from `.env.example`)
- **Health check**: `GET /health`
- **Networking**: private subnet; reachable only from API service security group

### Volumes

- EFS mount for `TRADINGAGENTS_RESULTS_DIR`, cache, and checkpoints
- Or S3 sync for report artifacts

## Secrets (required)

Configure per provider in Secrets Manager:

- `OPENAI_API_KEY`
- `GOOGLE_API_KEY` / `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- Provider-specific keys as needed

## Scaling

- One run per task thread today (in-memory run manager)
- For production: add Redis-backed job queue and horizontal workers
- Limit concurrent runs per task to avoid OOM

## Monitoring

- Run duration and error rate
- LLM token usage (emitted via SSE `stats` events)
- Container memory during deep (`researchDepth: 5`) runs
