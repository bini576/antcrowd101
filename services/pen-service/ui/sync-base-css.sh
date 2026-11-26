#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/ui/base.css"

for target in \
  "$ROOT_DIR/frontend/src/base.css" \
  "$ROOT_DIR/researcher-frontend/src/base.css" \
  "$ROOT_DIR/external-researcher-frontend/src/base.css"; do
  cp "$SRC" "$target"
  echo "synced $target"
done
