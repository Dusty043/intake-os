#!/bin/bash
# Temporary manual-testing helper (not part of the app) — runs the API dev
# server with .env loaded and AI_PROVIDER forced to "openai" for this
# process only, without touching the .env file's default (mock).
set -a
source .env
set +a
export AI_PROVIDER=openai
export PORT=3055
exec npm run api:start:dev
