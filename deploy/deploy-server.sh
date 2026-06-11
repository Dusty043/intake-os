#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.server.yml"

if [ ! -f .env.server ]; then
  echo "Error: .env.server not found."
  echo "Copy the example first: cp .env.server.example .env.server"
  exit 1
fi

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building server images..."
docker compose -f "$COMPOSE_FILE" --env-file .env.server build

echo "==> Starting server stack..."
docker compose -f "$COMPOSE_FILE" --env-file .env.server up -d

echo "==> Stack status:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server ps

echo "==> Recent API logs:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server logs --tail=80 api

echo "==> Recent web logs:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server logs --tail=80 web

echo "==> Recent proxy logs:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server logs --tail=80 local-proxy

echo "==> Deploy complete. Run healthcheck with: bash deploy/healthcheck-server.sh"
