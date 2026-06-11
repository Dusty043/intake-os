#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.server.yml"

if [ $# -ne 1 ]; then
  echo "Usage: bash deploy/restore-postgres.sh backups/intake_os_YYYYMMDD_HHMMSS.sql"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -f .env.server ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.server
  set +a
else
  echo "Error: .env.server not found."
  exit 1
fi

echo "This will restore $BACKUP_FILE into database: $POSTGRES_DB"
echo "This may overwrite or duplicate data depending on the dump contents."
read -r -p "Type RESTORE to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi

echo "==> Restoring $BACKUP_FILE ..."
docker compose -f "$COMPOSE_FILE" --env-file .env.server exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$BACKUP_FILE"

echo "==> Restore complete."
