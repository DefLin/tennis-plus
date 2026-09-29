#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing backend/.env. Copy .env.example and fill secrets first." >&2
  exit 1
fi

docker compose up -d --build
docker compose ps

for ((attempt = 1; attempt <= 30; attempt++)); do
  if response=$(curl --fail --silent --max-time 2 http://127.0.0.1:3000/health); then
    printf '%s\n' "$response"
    exit 0
  fi
  sleep 1
done

echo "API did not become healthy within 30 attempts." >&2
docker compose logs --tail=50 api >&2
exit 1
