"""
apps/agents-service/main.py

FastAPI entry point for the TradingAgents Python agents-service (port 8000).
Wraps existing tradingagents/ and cli/ logic from the repository root.

Run locally:
  PYTHONPATH=../.. uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes_config import router as config_router
from routes_runs import router as runs_router

app = FastAPI(
    title="TradingAgents Agents Service",
    version="1.0.0",
    description="Internal Python microservice wrapping LangGraph trading agents.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_router)
app.include_router(runs_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "tradingagents-agents-service"}
