#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8089}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

json_get() {
  local path="$1"
  python3 -c '
import json
import sys

path = sys.argv[1].split(".")
data = json.load(sys.stdin)
value = data
for segment in path:
    if isinstance(value, dict):
        value = value.get(segment)
    else:
        value = None
    if value is None:
        break

if isinstance(value, (dict, list)):
    print(json.dumps(value))
elif value is None:
    print("")
else:
    print(value)
' "$path"
}

csrf_for_jar() {
  local jar="$1"
  curl -fsS -c "$jar" "$BASE_URL/api/auth/csrf" >/dev/null
  awk '$6 == "antcrowd_csrf" { print $7 }' "$jar" | tail -n 1
}

auth_login() {
  local email="$1"
  local password="$2"
  local jar="$3"
  local csrf
  csrf="$(csrf_for_jar "$jar")"
  curl -fsS -c "$jar" -b "$jar" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $csrf" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    "$BASE_URL/api/auth/login"
}

auth_me() {
  local jar="$1"
  curl -fsS -b "$jar" "$BASE_URL/api/auth/me"
}

workspace_bootstrap() {
  local jar="$1"
  local path="$2"
  curl -fsS -b "$jar" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -X POST \
    "$BASE_URL$path"
}

workspace_bootstrap_status() {
  local jar="$1"
  local path="$2"
  curl -s -o /dev/null -w '%{http_code}' -b "$jar" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -X POST \
    "$BASE_URL$path"
}

bearer_get() {
  local path="$1"
  local token="$2"
  curl -fsS -H "Authorization: Bearer $token" "$BASE_URL$path"
}

echo "[1/7] Checking gateway and auth readiness..."
curl -fsS "$BASE_URL/" >/dev/null
curl -fsS "$BASE_URL/api/auth/ready" >/dev/null

echo "[2/7] Verifying platform admin login..."
ADMIN_JAR="$TMP_DIR/admin.cookies"
ADMIN_LOGIN="$(auth_login "platform-admin@antcrowd.local" "Antcrowd123!" "$ADMIN_JAR")"
echo "$ADMIN_LOGIN" | json_get "user.accountType" | grep -qx "platform_admin"
echo "[ok] Platform admin login works"

echo "[3/7] Verifying approved organization flow..."
ORG_JAR="$TMP_DIR/org.cookies"
ORG_LOGIN="$(auth_login "org-admin@antcrowd.local" "Antcrowd123!" "$ORG_JAR")"
echo "$ORG_LOGIN" | json_get "user.accountType" | grep -qx "organization"
ORG_ME="$(auth_me "$ORG_JAR")"
echo "$ORG_ME" | json_get "user.approvalStatus" | grep -qx "approved"
ORG_PEN_BOOTSTRAP="$(workspace_bootstrap "$ORG_JAR" "/api/pen/api/auth/bootstrap")"
ORG_PEN_TOKEN="$(echo "$ORG_PEN_BOOTSTRAP" | json_get "access_token")"
test -n "$ORG_PEN_TOKEN"
bearer_get "/api/pen/api/dashboard" "$ORG_PEN_TOKEN" >/dev/null
ORG_VDP_BOOTSTRAP="$(workspace_bootstrap "$ORG_JAR" "/api/vdp/auth/bootstrap")"
ORG_VDP_TOKEN="$(echo "$ORG_VDP_BOOTSTRAP" | json_get "access_token")"
test -n "$ORG_VDP_TOKEN"
bearer_get "/api/vdp/org/metrics" "$ORG_VDP_TOKEN" >/dev/null
ORG_TRAINING_BOOTSTRAP="$(workspace_bootstrap "$ORG_JAR" "/api/training/auth/bootstrap")"
ORG_TRAINING_TOKEN="$(echo "$ORG_TRAINING_BOOTSTRAP" | json_get "access_token")"
test -n "$ORG_TRAINING_TOKEN"
bearer_get "/api/training/training/requests" "$ORG_TRAINING_TOKEN" >/dev/null
echo "[ok] Approved organization can reach pen, VDP, and training"

echo "[4/7] Verifying pending organization login without service access..."
PENDING_ORG_JAR="$TMP_DIR/pending-org.cookies"
PENDING_ORG_LOGIN="$(auth_login "pending-org@antcrowd.local" "Antcrowd123!" "$PENDING_ORG_JAR")"
echo "$PENDING_ORG_LOGIN" | json_get "user.approvalStatus" | grep -qx "submitted"
PENDING_TRAINING_STATUS="$(workspace_bootstrap_status "$PENDING_ORG_JAR" "/api/training/auth/bootstrap")"
test "$PENDING_TRAINING_STATUS" = "403"
echo "[ok] Pending organization can sign in but cannot open approved services yet"

echo "[5/7] Verifying internal researcher flow..."
INTERNAL_JAR="$TMP_DIR/internal.cookies"
INTERNAL_LOGIN="$(auth_login "internal1@antcrowd.local" "Antcrowd123!" "$INTERNAL_JAR")"
echo "$INTERNAL_LOGIN" | json_get "user.researcherType" | grep -qx "internal"
echo "$INTERNAL_LOGIN" | json_get "user.approvalStatus" | grep -qx "approved"
INTERNAL_PEN_BOOTSTRAP="$(workspace_bootstrap "$INTERNAL_JAR" "/api/pen-researcher/api/auth/bootstrap")"
INTERNAL_PEN_TOKEN="$(echo "$INTERNAL_PEN_BOOTSTRAP" | json_get "access_token")"
test -n "$INTERNAL_PEN_TOKEN"
bearer_get "/api/pen-researcher/api/researcher/profile" "$INTERNAL_PEN_TOKEN" >/dev/null
INTERNAL_TRAINING_BOOTSTRAP="$(workspace_bootstrap "$INTERNAL_JAR" "/api/training/auth/bootstrap")"
INTERNAL_TRAINING_TOKEN="$(echo "$INTERNAL_TRAINING_BOOTSTRAP" | json_get "access_token")"
test -n "$INTERNAL_TRAINING_TOKEN"
bearer_get "/api/training/training/plans" "$INTERNAL_TRAINING_TOKEN" >/dev/null
echo "[ok] Internal researcher can reach pen and training"

echo "[6/7] Verifying external researcher flow and access boundary..."
EXTERNAL_JAR="$TMP_DIR/external.cookies"
EXTERNAL_LOGIN="$(auth_login "alpha@crowd.local" "Antcrowd123!" "$EXTERNAL_JAR")"
echo "$EXTERNAL_LOGIN" | json_get "user.researcherType" | grep -qx "external"
echo "$EXTERNAL_LOGIN" | json_get "user.approvalStatus" | grep -qx "approved"
EXTERNAL_PEN_BOOTSTRAP="$(workspace_bootstrap "$EXTERNAL_JAR" "/api/pen-researcher/api/auth/bootstrap")"
EXTERNAL_PEN_TOKEN="$(echo "$EXTERNAL_PEN_BOOTSTRAP" | json_get "access_token")"
test -n "$EXTERNAL_PEN_TOKEN"
bearer_get "/api/pen-researcher/api/researcher/engagements" "$EXTERNAL_PEN_TOKEN" >/dev/null
EXTERNAL_VDP_STATUS="$(workspace_bootstrap_status "$EXTERNAL_JAR" "/api/vdp/auth/bootstrap")"
test "$EXTERNAL_VDP_STATUS" = "403"
echo "[ok] External researcher can reach pen and is blocked from VDP"

echo "[7/7] Verifying integrated workspace pages are served..."
curl -fsS "$BASE_URL/" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/admin/" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/workspace/pen/org/" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/workspace/pen/internal/" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/workspace/pen/external/" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/workspace/vdp/org/org-admin" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/workspace/training/org/organization/training" | grep -qi "<!doctype html>"
curl -fsS "$BASE_URL/workspace/training/researcher/researcher" | grep -qi "<!doctype html>"
echo "[ok] Integrated platform, admin, and workspace frontends are responding"

cat <<'TXT'

[done] AntCrowd smoke test passed.
- Admin auth login works
- Approved organization can launch pen, VDP, and training
- Pending organization is gated from approved services
- Internal researcher can launch pen and training
- External researcher can launch pen and is blocked from VDP
- Integrated workspace pages are responding through the gateway

TXT
