#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_COMPOSE="$ROOT_DIR/infra/docker-compose.yml"

echo "[1/1] Resetting AntCrowd demo data (containers + volumes)..."
docker compose -f "$INFRA_COMPOSE" down -v --remove-orphans >/dev/null
echo "[ok] Demo data reset complete. Run ./scripts/demo-up.sh to rebuild a fresh presentation environment."
