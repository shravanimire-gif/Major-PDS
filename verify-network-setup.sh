#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   PDS Network Setup Verification${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check 1: Current WiFi IP
echo -e "${YELLOW}[1/6] Checking WiFi IP Address...${NC}"
CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$CURRENT_IP" ]; then
    echo -e "${RED}❌ No WiFi IP found. Are you connected to WiFi?${NC}"
    exit 1
else
    echo -e "${GREEN}✅ WiFi IP: $CURRENT_IP${NC}"
    if [ "$CURRENT_IP" != "172.18.241.180" ]; then
        echo -e "${YELLOW}⚠️  IP changed! Expected: 172.18.241.180${NC}"
        echo -e "${YELLOW}   Update pds-beneficiary/.env with: EXPO_PUBLIC_API_BASE_URL=http://$CURRENT_IP:5001${NC}"
    fi
fi
echo ""

# Check 2: Backend .env configuration
echo -e "${YELLOW}[2/6] Checking Backend Configuration...${NC}"
if [ -f "pds-backend/.env" ]; then
    BACKEND_PORT=$(grep "^PORT=" pds-backend/.env | cut -d'=' -f2)
    BACKEND_HOST=$(grep "^HOST=" pds-backend/.env | cut -d'=' -f2)
    
    if [ "$BACKEND_PORT" = "5001" ]; then
        echo -e "${GREEN}✅ Backend PORT: $BACKEND_PORT${NC}"
    else
        echo -e "${RED}❌ Backend PORT: $BACKEND_PORT (should be 5001)${NC}"
    fi
    
    if [ "$BACKEND_HOST" = "0.0.0.0" ]; then
        echo -e "${GREEN}✅ Backend HOST: $BACKEND_HOST (listening on all interfaces)${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend HOST: $BACKEND_HOST (should be 0.0.0.0)${NC}"
    fi
else
    echo -e "${RED}❌ pds-backend/.env not found${NC}"
fi
echo ""

# Check 3: React Native .env configuration
echo -e "${YELLOW}[3/6] Checking React Native Configuration...${NC}"
if [ -f "pds-beneficiary/.env" ]; then
    RN_API_URL=$(grep "^EXPO_PUBLIC_API_BASE_URL=" pds-beneficiary/.env | cut -d'=' -f2)
    echo -e "${GREEN}✅ API Base URL: $RN_API_URL${NC}"
    
    if [[ "$RN_API_URL" == *"$CURRENT_IP"* ]]; then
        echo -e "${GREEN}✅ URL matches current IP${NC}"
    else
        echo -e "${YELLOW}⚠️  URL doesn't match current IP${NC}"
    fi
else
    echo -e "${RED}❌ pds-beneficiary/.env not found${NC}"
fi
echo ""

# Check 4: Backend server running
echo -e "${YELLOW}[4/6] Checking if Backend is Running...${NC}"
if lsof -i :5001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server is running on port 5001${NC}"
    PROCESS=$(lsof -i :5001 | grep LISTEN | awk '{print $1}')
    echo -e "   Process: $PROCESS"
else
    echo -e "${RED}❌ Backend server is NOT running on port 5001${NC}"
    echo -e "${YELLOW}   Start it with: cd pds-backend && npm start${NC}"
fi
echo ""

# Check 5: Test backend connectivity
echo -e "${YELLOW}[5/6] Testing Backend Connectivity...${NC}"
if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$CURRENT_IP:5001/api/admin/test 2>/dev/null)
    
    if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Backend is accessible at http://$CURRENT_IP:5001${NC}"
        echo -e "   HTTP Status: $HTTP_CODE"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}❌ Cannot connect to backend${NC}"
        echo -e "${YELLOW}   Make sure backend is running and firewall allows connections${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend responded with status: $HTTP_CODE${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  curl not found, skipping connectivity test${NC}"
fi
echo ""

# Check 6: Firewall status
echo -e "${YELLOW}[6/6] Checking Firewall Status...${NC}"
if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate | grep -q "enabled"; then
    echo -e "${YELLOW}⚠️  Firewall is enabled${NC}"
    echo -e "${YELLOW}   If you have connection issues, allow Node.js:${NC}"
    echo -e "${YELLOW}   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add node${NC}"
    echo -e "${YELLOW}   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp node${NC}"
else
    echo -e "${GREEN}✅ Firewall is disabled${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "WiFi IP:        ${GREEN}$CURRENT_IP${NC}"
echo -e "Backend URL:    ${GREEN}http://$CURRENT_IP:5001${NC}"
echo -e "API Base URL:   ${GREEN}$RN_API_URL${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Start backend:  ${GREEN}cd pds-backend && npm start${NC}"
echo -e "2. Start Expo:     ${GREEN}cd pds-beneficiary && npx expo start${NC}"
echo -e "3. Scan QR code with Expo Go app on your phone"
echo -e "4. Make sure phone is on the same WiFi network"
echo ""
echo -e "${BLUE}Test backend from phone browser:${NC}"
echo -e "${GREEN}http://$CURRENT_IP:5001/api/admin/test${NC}"
echo ""
