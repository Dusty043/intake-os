#!/bin/bash
# Temporary manual-testing helper (not part of the app) — points the web dev
# server at the test API instance on :3055 instead of the default :3000.
export NEXT_PUBLIC_API_BASE_URL=http://localhost:3055
exec npm run web:dev
