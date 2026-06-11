#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.server.yml"

if [ -f .env.server ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.server
  set +a
else
  echo "Error: .env.server not found."
  exit 1
fi

mkdir -p backups

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="backups/intake_os_${TIMESTAMP}.sql"

echo "==> Dumping $POSTGRES_DB to $BACKUP_FILE ..."
docker compose -f "$COMPOSE_FILE" --env-file .env.server exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"

echo "==> Backup complete: $BACKUP_FILE"
