#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "==> Checking web through proxy ($BASE_URL)..."
curl -fsS "$BASE_URL" > /dev/null
echo "    Web OK"

echo "==> Checking API liveness through proxy..."
curl -fsS "$BASE_URL/api/health"
echo

echo "==> Checking API database readiness through proxy..."
curl -fsS "$BASE_URL/api/health/db"
echo

echo "==> Checking OpenAPI through proxy..."
if curl -fsS "$BASE_URL/api/docs-json" > /dev/null; then
  echo "    OpenAPI OK"
else
  echo "    OpenAPI unavailable or disabled (non-fatal)"
fi

echo "==> Healthcheck passed."
