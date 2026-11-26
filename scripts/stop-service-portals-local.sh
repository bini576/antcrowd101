#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.demo/service-portals"

if [[ ! -d "$STATE_DIR" ]]; then
  echo "[info] No local service-portal state directory found."
  exit 0
fi

shopt -s nullglob
for pid_file in "$STATE_DIR"/*.pid; do
  pid="$(cat "$pid_file")"
  name="$(basename "$pid_file" .pid)"
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    echo "[stop] $name ($pid)"
  fi
  rm -f "$pid_file"
done

pkill -f "/services/challenge-service/frontend/node_modules/.bin/vite --port 3000 --host" >/dev/null 2>&1 || true
pkill -f "/services/ai-redteam-service/frontend/node_modules/.bin/vite --port 3001 --host" >/dev/null 2>&1 || true
pkill -f "/services/bug-bounty-service/frontend/node_modules/.bin/vite --port 3002 --host" >/dev/null 2>&1 || true
pkill -f "/services/challenge-service/.+uvicorn src.main:app --host 0.0.0.0 --port 8003" >/dev/null 2>&1 || true
pkill -f "/services/ai-redteam-service/.+uvicorn src.main:app --host 0.0.0.0 --port 8004" >/dev/null 2>&1 || true
pkill -f "/services/bug-bounty-service/.+uvicorn src.main:app --host 0.0.0.0 --port 8005" >/dev/null 2>&1 || true

echo "[done] Requested shutdown for local service portals."
