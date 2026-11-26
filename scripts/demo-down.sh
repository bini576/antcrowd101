#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_COMPOSE="$ROOT_DIR/infra/docker-compose.yml"

echo "[1/1] Stopping unified demo stack..."
docker compose -f "$INFRA_COMPOSE" down >/dev/null

echo "[ok] AntCrowd demo environment stopped."
