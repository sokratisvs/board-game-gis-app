#!/usr/bin/env bash
# Validate deploy setup: files, docker-compose, and optionally build/up.
# Run from project root: ./scripts/validate-deploy.sh [--build] [--up]
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Required files ==="
FILES=(
  "Jenkinsfile"
  "containers/docker-compose.yml"
  "containers/backend/Dockerfile"
  "containers/frontend/Dockerfile"
  "containers/postgres/Dockerfile"
  "containers/postgres/db.sql"
  "client/nginx.conf"
  "server/package.json"
  "server/server.js"
)
MISSING=()
for f in "${FILES[@]}"; do
  if [ -e "$f" ]; then
    echo "  [OK] $f"
  else
    echo "  [MISSING] $f"
    MISSING+=("$f")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}Missing: ${MISSING[*]}${NC}"
  exit 1
fi

echo ""
echo "=== 2. .env for compose ==="
if [ ! -f .env ]; then
  echo -e "${YELLOW}  No .env — copy .env-example and set DB_*, COOKIE_SECRET, etc.${NC}"
  echo "  For 'config' only we use defaults; --build/--up need a real .env"
  export NODE_ENV=local DB_USER=postgres DB_PASSWORD=p DB_NAME=board_gis_db
  export COOKIE_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  export CLIENT_URLS=http://localhost:3000 REACT_APP_API_BASE_URL=http://localhost:4000
  export FRONTEND_PORT=3000 BACKEND_PORT=4000
else
  echo "  [OK] .env exists"
fi

echo ""
echo "=== 3. docker compose config (validate YAML and paths) ==="
if ! command -v docker &>/dev/null; then
  echo -e "${YELLOW}  Docker not in PATH — skipping compose config${NC}"
else
  COMPOSE_CMD="docker compose -f containers/docker-compose.yml"
  [ -f .env ] && COMPOSE_CMD="$COMPOSE_CMD --env-file .env"
  if $COMPOSE_CMD config >/dev/null 2>&1; then
    echo -e "  ${GREEN}[OK] docker compose config${NC}"
  else
    echo -e "${RED}  docker compose config failed:${NC}"
    $COMPOSE_CMD config 2>&1 || true
    exit 1
  fi
fi

echo ""
echo "=== 4. Optional: build (--build) and up (--up) ==="
DO_BUILD=false
DO_UP=false
for a in "$@"; do
  [ "$a" = "--build" ] && DO_BUILD=true
  [ "$a" = "--up" ]   && DO_UP=true
done

if [ "$DO_BUILD" = true ] || [ "$DO_UP" = true ]; then
  if ! command -v docker &>/dev/null; then
    echo -e "${YELLOW}  Docker not in PATH — skipping build/up${NC}"
  else
    DC="docker compose -f containers/docker-compose.yml"
    [ -f .env ] && DC="$DC --env-file .env"
    [ "$DO_BUILD" = true ] && echo "  Running: $DC build"
    [ "$DO_UP" = true ]   && echo "  Running: $DC up -d"
    if [ "$DO_BUILD" = true ]; then
      if $DC build; then
        echo -e "  ${GREEN}[OK] build${NC}"
      else
        echo -e "${RED}  build failed${NC}"
        exit 1
      fi
    fi
    if [ "$DO_UP" = true ]; then
      if $DC up -d; then
        echo -e "  ${GREEN}[OK] up -d (containers started)${NC}"
        echo "  To stop: $DC down"
      else
        echo -e "${RED}  up failed${NC}"
        exit 1
      fi
    fi
  fi
else
  echo "  Skipped. Use: $0 --build       to build images"
  echo "               $0 --build --up  to build and start containers"
fi

echo ""
echo -e "${GREEN}=== Validation done ===${NC}"
