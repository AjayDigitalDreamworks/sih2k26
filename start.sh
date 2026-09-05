#!/bin/bash
#  Raahi — Start All Services

set -e
cd "$(dirname "$0")"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     🚛 Raahi — Starting All Services             ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Docker is not running. Starting services without Docker...${NC}"
  echo ""
fi

echo -e "${CYAN}Starting ML Service...${NC}"
cd ml-service && python -m uvicorn app.main:app --reload --port 8010 &
ML_PID=$!
cd ..

echo -e "${CYAN}Starting Backend...${NC}"
cd core-backend && npm run dev &
BACKEND_PID=$!
cd ..

echo -e "${CYAN}Starting Frontend...${NC}"
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo -e "   Frontend:  http://localhost:3000"
echo -e "   Backend:   http://localhost:5000"
echo -e "   ML Service: http://localhost:8010"
echo ""

# Wait for all processes
wait
