#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_COMPOSE="$ROOT_DIR/infra/docker-compose.yml"

wait_for_http() {
  local url="$1"
  local retries="${2:-80}"
  local sleep_sec="${3:-2}"
  local i
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_sec"
  done
  return 1
}

compose_up_with_retry() {
  local compose_file="$1"
  local stack_label="$2"
  local attempts="${3:-4}"
  local sleep_sec=5
  local i

  for ((i=1; i<=attempts; i++)); do
    if docker compose -f "$compose_file" up -d --build; then
      return 0
    fi

    if [[ "$i" -lt "$attempts" ]]; then
      echo "[warn] ${stack_label} startup failed (attempt ${i}/${attempts}). Retrying in ${sleep_sec}s..."
      sleep "$sleep_sec"
      sleep_sec=$((sleep_sec * 2))
    fi
  done

  echo "[error] ${stack_label} failed to start after ${attempts} attempts."
  return 1
}

generate_vdp_org_token() {
  local org_id="${1:-00000000-0000-0000-0000-000000000001}"
  python3 - "$org_id" <<'PY'
import base64, hashlib, hmac, json, time
import sys

secret = b"dev-secret"
org_id = sys.argv[1]

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header = {"alg": "HS256", "typ": "JWT"}
payload = {
    "user_id": "99999999-9999-9999-9999-999999999999",
    "role": "organization",
    "org_id": org_id,
    "exp": int(time.time()) + 8 * 3600,
}

h = b64url(json.dumps(header, separators=(",", ":")).encode())
p = b64url(json.dumps(payload, separators=(",", ":")).encode())
sig = hmac.new(secret, f"{h}.{p}".encode(), hashlib.sha256).digest()
print(f"{h}.{p}.{b64url(sig)}")
PY
}

resolve_vdp_org_id() {
  local detected=""
  detected="$(
    curl -fsS "http://localhost:8103/api/vdp/organizations" 2>/dev/null | python3 - <<'PY'
import json
import sys

try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and data and isinstance(data[0], dict):
        org_id = data[0].get("id", "")
        if isinstance(org_id, str):
            print(org_id)
except Exception:
    pass
PY
  )"

  if [[ -n "$detected" ]]; then
    echo "$detected"
  else
    echo "00000000-0000-0000-0000-000000000001"
  fi
}

ensure_training_demo_researcher() {
  python3 - <<'PY' || true
import json
from urllib import error, request

BASE = "http://localhost:8100"
ADMIN_EMAIL = "admin@acmecorp.com"
ADMIN_PASSWORD = "Admin123!"
DEMO_EMAIL = "demo.trainer@acmecorp.com"
DEMO_PASSWORD = "Trainer123!"

def call(method, path, payload=None, token=None):
    url = f"{BASE}{path}"
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, data=body, method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode() or "{}"
            return resp.status, json.loads(raw)
    except error.HTTPError as exc:
        raw = exc.read().decode() or "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {"detail": raw}
        return exc.code, data
    except Exception as exc:
        return 0, {"detail": str(exc)}

status, login = call("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
if status != 200:
    print(f"[warn] Could not auto-prepare training demo researcher (admin login failed: {login.get('detail', status)})")
    raise SystemExit(0)

token = login["access_token"]
_, requests_data = call("GET", "/training/requests", token=token)
_, plans_data = call("GET", "/training/plans", token=token)
_, reports_data = call("GET", "/reports", token=token)

request_status = {item["id"]: item.get("status") for item in requests_data}
reported_plan_ids = {item["training_plan_id"] for item in reports_data}

candidate = None
for plan in plans_data:
    if request_status.get(plan["request_id"]) == "scheduled" and plan["id"] not in reported_plan_ids:
        candidate = plan
        break

if not candidate:
    print("[warn] No scheduled training plan is currently available for report submission.")
    raise SystemExit(0)

register_payload = {
    "email": DEMO_EMAIL,
    "password": DEMO_PASSWORD,
    "role": "trainer",
    "trainer_id": candidate["trainer_id"],
}
reg_status, reg_data = call("POST", "/auth/register", register_payload, token=token)
chosen_email = DEMO_EMAIL
chosen_password = DEMO_PASSWORD

if reg_status == 409:
    login_status, login_data = call("POST", "/auth/login", {"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    demo_user = login_data.get("user", {}) if login_status == 200 else {}
    if demo_user.get("trainer_id") != candidate["trainer_id"]:
        fallback_email = f"demo.trainer.{candidate['trainer_id'][:8]}@acmecorp.com"
        fallback_payload = {
            "email": fallback_email,
            "password": DEMO_PASSWORD,
            "role": "trainer",
            "trainer_id": candidate["trainer_id"],
        }
        fallback_status, fallback_data = call("POST", "/auth/register", fallback_payload, token=token)
        if fallback_status not in (201, 409):
            print(f"[warn] Could not prepare training demo researcher account: {fallback_data.get('detail', fallback_status)}")
            raise SystemExit(0)
        chosen_email = fallback_email
elif reg_status != 201:
    print(f"[warn] Could not prepare training demo researcher account: {reg_data.get('detail', reg_status)}")
    raise SystemExit(0)

print(f"[ok] Training demo researcher ready: {chosen_email} / {chosen_password}")
PY
}

echo "[1/2] Starting unified demo stack from infra/docker-compose.yml..."
compose_up_with_retry "$INFRA_COMPOSE" "Infra stack"

echo "[2/2] Waiting for services to be ready..."
wait_for_http "http://localhost:8092/ready" 60 2 || echo "[warn] Auth readiness check not ready yet."
wait_for_http "http://localhost:8106/ready" 60 2 || echo "[warn] Pen backend readiness check not ready yet."
wait_for_http "http://localhost:8107/ready" 60 2 || echo "[warn] Pen researcher backend readiness check not ready yet."
if ! wait_for_http "http://localhost:8103/ready" 60 2; then
  echo "[warn] VDP backend health check not ready yet. Restarting vdp-service once..."
  docker compose -f "$INFRA_COMPOSE" up -d vdp-service
  wait_for_http "http://localhost:8103/ready" 60 2 || echo "[warn] VDP backend still not ready after restart."
fi
wait_for_http "http://localhost:8100/docs" 60 2 || echo "[warn] Training backend docs not ready yet."
wait_for_http "http://localhost:8089/" 60 2 || echo "[warn] Main platform gateway not ready yet."
wait_for_http "http://localhost:8089/admin/" 60 2 || echo "[warn] Integrated admin workspace not ready yet."
wait_for_http "http://localhost:8089/workspace/pen/org/" 60 2 || echo "[warn] Pen organization workspace route not ready yet."
wait_for_http "http://localhost:8089/workspace/pen/internal/" 60 2 || echo "[warn] Pen internal researcher workspace route not ready yet."
wait_for_http "http://localhost:8089/workspace/pen/external/" 60 2 || echo "[warn] Pen external researcher workspace route not ready yet."
wait_for_http "http://localhost:8089/workspace/training/org/organization/training" 60 2 || echo "[warn] Training organization workspace route not ready yet."
wait_for_http "http://localhost:8089/workspace/training/researcher/researcher" 60 2 || echo "[warn] Training researcher workspace route not ready yet."
wait_for_http "http://localhost:8089/workspace/vdp/org/org-admin" 60 2 || echo "[warn] VDP organization workspace route not ready yet."
wait_for_http "http://localhost:5276" 60 2 || echo "[warn] Pen org frontend not ready yet."
wait_for_http "http://localhost:5277" 60 2 || echo "[warn] Pen internal researcher frontend not ready yet."
wait_for_http "http://localhost:5278" 60 2 || echo "[warn] Pen external researcher frontend not ready yet."
wait_for_http "http://localhost:5286/admin/" 60 2 || echo "[warn] Standalone admin frontend not ready yet."
wait_for_http "http://localhost:5274" 60 2 || echo "[warn] Training organization frontend not ready yet."
wait_for_http "http://localhost:5275" 60 2 || echo "[warn] Training researcher frontend not ready yet."
wait_for_http "http://localhost:5284" 60 2 || echo "[warn] VDP public frontend not ready yet."
wait_for_http "http://localhost:5285" 60 2 || echo "[warn] VDP admin frontend not ready yet."
ensure_training_demo_researcher

echo "[extra] Running presentation smoke test..."
"$ROOT_DIR/scripts/smoke-test.sh"

VDP_ORG_ID="$(resolve_vdp_org_id)"
VDP_TOKEN="$(generate_vdp_org_token "$VDP_ORG_ID")"
VDP_ADMIN_URL="http://localhost:5285/?token=${VDP_TOKEN}&role=organization&org_id=${VDP_ORG_ID}"

cat <<TXT

================= AntCrowd Demo Ready =================

Primary Presentation Entry Points:
- Main Platform:              http://localhost:8089/
- Admin Console:              http://localhost:8089/admin/

Integrated Workspace Routes:
- Pen Organization:           http://localhost:8089/workspace/pen/org/
- Pen Internal Researcher:    http://localhost:8089/workspace/pen/internal/
- Pen External Researcher:    http://localhost:8089/workspace/pen/external/
- Training Organization:      http://localhost:8089/workspace/training/org/organization/training
- Training Researcher:        http://localhost:8089/workspace/training/researcher/researcher
- VDP Organization:           http://localhost:8089/workspace/vdp/org/org-admin

Standalone Service Frontends:
- Pen Org Frontend:           http://localhost:5276/#/org
- Pen Internal Frontend:      http://localhost:5277/
- Pen External Frontend:      http://localhost:5278/
- Training Org Frontend:      http://localhost:5274/
- Training Researcher Front:  http://localhost:5275/
- VDP Public Frontend:        http://localhost:5284/
- VDP Admin Frontend:         $VDP_ADMIN_URL

Service APIs:
- Pen Org/Admin API:          http://localhost:8106/
- Pen Researcher API:         http://localhost:8107/
- Training Backend Docs:      http://localhost:8100/docs
- VDP Backend API:            http://localhost:8103/

Infra:
- Mailpit:                    http://localhost:8125/
- MinIO Console:              http://localhost:9101/   (minio / minio123)

Suggested Demo Credentials:
- Platform Admin:             platform-admin@antcrowd.local / Antcrowd123!
- Approved Organization:      org-admin@antcrowd.local / Antcrowd123!
- Pending Organization:       pending-org@antcrowd.local / Antcrowd123!
- Internal Researcher:        internal1@antcrowd.local / Antcrowd123!
- External Researcher:        alpha@crowd.local / Antcrowd123!
- Training Admin:             admin@acmecorp.com / Admin123!
- Training Researcher (Demo): see "[ok] Training demo researcher ready" line above.

To stop everything:
  ./scripts/demo-down.sh

To reset all demo data and rebuild from scratch:
  ./scripts/demo-reset.sh

=======================================================
TXT
