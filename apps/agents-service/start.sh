#!/bin/sh
set -e
# Bind on :: so Railway private networking (often IPv6) can reach the service.
exec uvicorn main:app --host :: --port "${PORT:-8000}"
