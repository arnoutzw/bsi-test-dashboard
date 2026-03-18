#!/usr/bin/env bash
# submit-run.sh — Submit a test run JSON to the BSI Test Dashboard API
#
# Usage:
#   ./scripts/submit-run.sh <run.json>
#   ./scripts/submit-run.sh <run.json> --manifest <manifest.json>
#   pbpaste | ./scripts/submit-run.sh -
#
# Environment:
#   DASHBOARD_URL  Base URL (default: https://bsi-test-dashboard.pages.dev)

set -euo pipefail

DASHBOARD_URL="${DASHBOARD_URL:-https://bsi-test-dashboard.pages.dev}"
MANIFEST_FILE=""
INPUT_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST_FILE="$2"
      shift 2
      ;;
    -)
      INPUT_FILE="-"
      shift
      ;;
    *)
      INPUT_FILE="$1"
      shift
      ;;
  esac
done

if [[ -z "$INPUT_FILE" ]]; then
  echo "Usage: $0 <run.json> [--manifest <manifest.json>]"
  echo "       pbpaste | $0 -"
  exit 1
fi

# Read input
if [[ "$INPUT_FILE" == "-" ]]; then
  RUN_JSON=$(cat)
else
  if [[ ! -f "$INPUT_FILE" ]]; then
    echo "Error: File not found: $INPUT_FILE"
    exit 1
  fi
  RUN_JSON=$(cat "$INPUT_FILE")
fi

# Validate JSON
if ! echo "$RUN_JSON" | python3 -m json.tool > /dev/null 2>&1; then
  echo "Error: Invalid JSON"
  exit 1
fi

# Merge manifest if provided
if [[ -n "$MANIFEST_FILE" && -f "$MANIFEST_FILE" ]]; then
  MANIFEST_JSON=$(cat "$MANIFEST_FILE")
  RUN_JSON=$(echo "$RUN_JSON" | python3 -c "
import json, sys
run = json.load(sys.stdin)
manifest = json.load(open('$MANIFEST_FILE'))
run['manifest'] = manifest
if 'version' in manifest:
    run['manifestVersion'] = manifest['version']
if 'date' in manifest:
    run['manifestDate'] = manifest['date']
print(json.dumps(run))
")
  echo "Merged manifest v$(echo "$MANIFEST_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('version','?'))")"
fi

# Extract summary
PASS=$(echo "$RUN_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('totalPass','?'))")
FAIL=$(echo "$RUN_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('totalFail','?'))")
TOTAL=$(echo "$RUN_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('totalTests','?'))")
VERSION=$(echo "$RUN_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('manifestVersion','unknown'))")
MODE=$(echo "$RUN_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('mode','unknown'))")

echo "Submitting: v${VERSION} ${MODE} — ${PASS}/${TOTAL} pass, ${FAIL} fail"

# POST to dashboard API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${DASHBOARD_URL}/api/runs" \
  -H "Content-Type: application/json" \
  -d "$RUN_JSON")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "201" ]]; then
  RUN_ID=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  echo "Submitted successfully: ${RUN_ID}"
  echo "View at: ${DASHBOARD_URL}/#run/${RUN_ID}"
else
  echo "Error (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi
