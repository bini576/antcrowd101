#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APPLY=false
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

# Legacy files/dirs from pre-modular layout.
TARGETS=(
  "app/controls.py"
  "app/organizations.py"
  "app/policy.py"
  "app/risk.py"
  "app/users.py"
  "app/routes_old.py"
  "app/schemas.py"
  "app/schemas_old.py"
  "app/models_old.py"
  "app/auth"
  "models.py"
)

# Include Python cache directories anywhere under app.
while IFS= read -r cache_dir; do
  TARGETS+=("$cache_dir")
done < <(find app -type d -name "__pycache__" 2>/dev/null || true)

removed_count=0

for target in "${TARGETS[@]}"; do
  [[ -e "$target" ]] || continue
  if [[ "$APPLY" == true ]]; then
    rm -rf "$target"
    echo "removed: $target"
  else
    echo "would remove: $target"
  fi
  removed_count=$((removed_count + 1))
done

if [[ "$removed_count" -eq 0 ]]; then
  echo "No unused legacy files found."
else
  if [[ "$APPLY" == true ]]; then
    echo "Cleanup complete. Removed $removed_count item(s)."
  else
    echo "Dry run complete. Use '--apply' to remove $removed_count item(s)."
  fi
fi
