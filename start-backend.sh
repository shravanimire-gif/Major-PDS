#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Starting PDS Backend Server${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Kill any existing processes on ports 5001 and 5055
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
lsof -ti :5001 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Killed process on port 5001${NC}" || echo -e "${GREEN}✅ Port 5001 is free${NC}"
lsof -ti :5055 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Killed process on port 5055${NC}" || echo -e "${GREEN}✅ Port 5055 is free${NC}"
sleep 1

# Check database connection
echo -e "\n${YELLOW}Checking database connection...${NC}"
if psql -U himanshumire -d ration_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo -e "${YELLOW}Make sure PostgreSQL is running: brew services start postgresql${NC}"
    exit 1
fi

# Get current IP
CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$CURRENT_IP" ]; then
    echo -e "${RED}❌ No WiFi IP found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ WiFi IP: $CURRENT_IP${NC}"

# Navigate to backend directory
cd "$(dirname "$0")/pds-backend" || exit 1

# Start the server
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}   Server Starting...${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo -e "${GREEN}Backend will be accessible at:${NC}"
echo -e "${GREEN}  - Local: http://localhost:5001${NC}"
echo -e "${GREEN}  - Network: http://$CURRENT_IP:5001${NC}\n"
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}\n"

# Start with npm
npm start
