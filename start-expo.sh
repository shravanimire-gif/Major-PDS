#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Starting Expo Development Server${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get current IP
CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$CURRENT_IP" ]; then
    echo -e "${RED}❌ No WiFi IP found. Are you connected to WiFi?${NC}"
    exit 1
fi

echo -e "${GREEN}✅ WiFi IP: $CURRENT_IP${NC}"

# Check if backend is running
echo -e "\n${YELLOW}Checking backend server...${NC}"
if lsof -i :5001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running on port 5001${NC}"
else
    echo -e "${RED}❌ Backend is NOT running${NC}"
    echo -e "${YELLOW}Start it first with: ./start-backend.sh${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check .env configuration
echo -e "\n${YELLOW}Checking configuration...${NC}"
if [ -f "pds-beneficiary/.env" ]; then
    API_URL=$(grep "^EXPO_PUBLIC_API_BASE_URL=" pds-beneficiary/.env | cut -d'=' -f2)
    echo -e "${GREEN}✅ API Base URL: $API_URL${NC}"
    
    if [[ "$API_URL" == *"$CURRENT_IP"* ]]; then
        echo -e "${GREEN}✅ Configuration matches current IP${NC}"
    else
        echo -e "${YELLOW}⚠️  Configuration doesn't match current IP${NC}"
        echo -e "${YELLOW}   Update pds-beneficiary/.env with:${NC}"
        echo -e "${YELLOW}   EXPO_PUBLIC_API_BASE_URL=http://$CURRENT_IP:5001${NC}"
    fi
else
    echo -e "${RED}❌ pds-beneficiary/.env not found${NC}"
    exit 1
fi

# Navigate to beneficiary directory
cd "$(dirname "$0")/pds-beneficiary" || exit 1

# Start Expo
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}   Expo Starting...${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo -e "${GREEN}Instructions:${NC}"
echo -e "1. Install Expo Go app on your phone"
echo -e "2. Make sure phone is on WiFi: ${GREEN}172.18.241.x${NC}"
echo -e "3. Scan the QR code with:"
echo -e "   - iOS: Camera app"
echo -e "   - Android: Expo Go app"
echo -e "\n${YELLOW}Press Ctrl+C to stop Expo${NC}\n"

# Start Expo with clear cache
npx expo start --clear
