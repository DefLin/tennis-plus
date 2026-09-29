#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing backend/.env. Copy .env.example and fill secrets first." >&2
  exit 1
fi

docker compose up -d --build
docker compose ps
curl --fail --silent --show-error http://127.0.0.1:3000/health
echo
