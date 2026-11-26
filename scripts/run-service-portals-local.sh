#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.demo/service-portals"
LOG_DIR="$STATE_DIR/logs"

mkdir -p "$LOG_DIR"

is_port_busy() {
  local port="$1"
  ss -ltn | grep -q ":${port}\b"
}

wait_for_http() {
  local url="$1"
  local timeout="${2:-30}"
  local elapsed=0

  while (( elapsed < timeout )); do
    if python3 - "$url" <<'PY' >/dev/null 2>&1
import sys
import urllib.request

with urllib.request.urlopen(sys.argv[1], timeout=2) as response:
    if 200 <= response.status < 500:
        raise SystemExit(0)
raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

start_process() {
  local name="$1"
  local workdir="$2"
  local port="$3"
  shift 3

  if is_port_busy "$port"; then
    echo "[error] Port $port is already in use. Free it first, then rerun this script."
    exit 1
  fi

  echo "[start] $name on port $port"
  (
    cd "$workdir"
    if command -v setsid >/dev/null 2>&1; then
      setsid "$@" >"$LOG_DIR/${name}.log" 2>&1 < /dev/null &
    else
      nohup "$@" >"$LOG_DIR/${name}.log" 2>&1 < /dev/null &
    fi
    echo $! >"$STATE_DIR/${name}.pid"
  )
}

init_sqlite_schema() {
  local workdir="$1"
  local db_path="$2"
  shift
  shift

  if [[ -e "$db_path" && ! -w "$db_path" ]]; then
    echo "[warn] Removing non-writable SQLite state at $db_path"
    rm -f "$db_path" "$db_path-shm" "$db_path-wal" "$db_path-journal"
  fi

  (
    cd "$workdir"
    env "$@" python3 - <<'PY'
from src.database import Base, engine
import src.models  # noqa: F401

Base.metadata.create_all(bind=engine)
PY
  )
}

init_sqlite_schema "$ROOT_DIR/services/challenge-service" "$STATE_DIR/challenge.db" DATABASE_URL="sqlite:///$STATE_DIR/challenge.db"
start_process \
  challenge-service \
  "$ROOT_DIR/services/challenge-service" \
  8003 \
  env DATABASE_URL="sqlite:///$STATE_DIR/challenge.db" python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8003

init_sqlite_schema "$ROOT_DIR/services/ai-redteam-service" "$STATE_DIR/ai-redteam.db" DATABASE_URL="sqlite:///$STATE_DIR/ai-redteam.db"
start_process \
  ai-redteam-service \
  "$ROOT_DIR/services/ai-redteam-service" \
  8004 \
  env DATABASE_URL="sqlite:///$STATE_DIR/ai-redteam.db" python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8004

init_sqlite_schema "$ROOT_DIR/services/bug-bounty-service" "$STATE_DIR/bug-bounty.db" DATABASE_URL="sqlite:///$STATE_DIR/bug-bounty.db"
start_process \
  bug-bounty-service \
  "$ROOT_DIR/services/bug-bounty-service" \
  8005 \
  env DATABASE_URL="sqlite:///$STATE_DIR/bug-bounty.db" python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8005

start_process \
  challenge-frontend \
  "$ROOT_DIR/services/challenge-service/frontend" \
  3000 \
  env VITE_SERVICE_KEY=challenge npm run dev

start_process \
  ai-redteam-frontend \
  "$ROOT_DIR/services/ai-redteam-service/frontend" \
  3001 \
  env VITE_SERVICE_KEY=ai-redteam npm run dev

start_process \
  bug-bounty-frontend \
  "$ROOT_DIR/services/bug-bounty-service/frontend" \
  3002 \
  env VITE_SERVICE_KEY=bug-bounty npm run dev

sleep 3

READY_CHECKS=(
  "Challenge frontend|http://127.0.0.1:3000"
  "AI red team frontend|http://127.0.0.1:3001"
  "Bug bounty frontend|http://127.0.0.1:3002"
  "Challenge API|http://127.0.0.1:8003/health"
  "AI red team API|http://127.0.0.1:8004/health"
  "Bug bounty API|http://127.0.0.1:8005/health"
)

for item in "${READY_CHECKS[@]}"; do
  label="${item%%|*}"
  url="${item##*|}"
  if wait_for_http "$url" 30; then
    echo "[ready] $label"
  else
    echo "[error] $label did not become ready at $url"
    echo "[error] Check logs in $LOG_DIR"
    exit 1
  fi
done

cat <<TXT

Challenge Service:
- Frontend: http://localhost:3000
- API:      http://localhost:8003

AI Red Team Service:
- Frontend: http://localhost:3001
- API:      http://localhost:8004

Bug Bounty Service:
- Frontend: http://localhost:3002
- API:      http://localhost:8005

Logs:
- $LOG_DIR

Stop everything with:
- bash scripts/stop-service-portals-local.sh
TXT
