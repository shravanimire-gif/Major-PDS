#!/bin/bash

# Complete Deployment Diagnostic Script
# Tests entire login flow from frontend to backend to database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${1:-https://major-project-mdhh.onrender.com}"
FRONTEND_URL="https://major-project-1-sdbw.onrender.com"
ADMIN_EMAIL="admin@pds.gov"
ADMIN_PASSWORD="admin123"

echo -e "${BLUE}========================================"
echo "PDS Deployment Diagnostic Script"
echo "========================================${NC}"
echo ""
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Test 1: Backend Health
echo -e "${YELLOW}TEST 1: Backend Health Check${NC}"
echo "Endpoint: GET /health"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ Backend is running${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ Backend health check failed (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
  exit 1
fi
echo ""

# Test 2: CORS Debug Info
echo -e "${YELLOW}TEST 2: CORS Configuration${NC}"
echo "Endpoint: GET /debug/cors"
CORS_RESPONSE=$(curl -s "$BACKEND_URL/debug/cors")
echo "Response:"
echo "$CORS_RESPONSE" | jq '.' 2>/dev/null || echo "$CORS_RESPONSE"
echo ""

# Test 3: API Info
echo -e "${YELLOW}TEST 3: API Information${NC}"
echo "Endpoint: GET /api-info"
API_INFO=$(curl -s "$BACKEND_URL/api-info")
echo "Response:"
echo "$API_INFO" | jq '.' 2>/dev/null || echo "$API_INFO"
echo ""

# Test 4: Preflight OPTIONS Request
echo -e "${YELLOW}TEST 4: Preflight OPTIONS Request${NC}"
echo "Testing from origin: $FRONTEND_URL"
PREFLIGHT=$(curl -s -i -X OPTIONS "$BACKEND_URL/auth/login" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" 2>&1)

PREFLIGHT_STATUS=$(echo "$PREFLIGHT" | head -n 1)
echo "Response Status: $PREFLIGHT_STATUS"
echo "CORS Headers:"
echo "$PREFLIGHT" | grep -i "access-control" || echo "No CORS headers found!"
echo ""

# Test 5: Direct Login Request
echo -e "${YELLOW}TEST 5: Direct Login Request${NC}"
echo "Endpoint: POST /auth/login"
echo "Credentials: $ADMIN_EMAIL / (masked)"
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  TOKEN=$(echo "$BODY" | jq -r '.token' 2>/dev/null)
  if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "Token: ${TOKEN:0:20}... (truncated)"
  fi
else
  echo -e "${RED}✗ Login failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 6: Login via /api/auth/login (alternate route)
echo -e "${YELLOW}TEST 6: Alternate Login Endpoint${NC}"
echo "Endpoint: POST /api/auth/login"
API_LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

HTTP_CODE=$(echo "$API_LOGIN" | tail -n 1)
BODY=$(echo "$API_LOGIN" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ Alternate login route works${NC}"
else
  echo -e "${RED}✗ Alternate login route failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 7: Invalid Credentials
echo -e "${YELLOW}TEST 7: Invalid Credentials Test${NC}"
echo "Endpoint: POST /auth/login"
INVALID=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $FRONTEND_URL" \
  -d '{"email":"invalid@test.com","password":"wrong"}')

HTTP_CODE=$(echo "$INVALID" | tail -n 1)
if [ "$HTTP_CODE" -eq 401 ]; then
  echo -e "${GREEN}✓ Invalid credentials properly rejected (HTTP 401)${NC}"
else
  echo -e "${RED}✗ Unexpected response for invalid credentials (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 8: Frontend to Backend Connectivity
echo -e "${YELLOW}TEST 8: Frontend URL Accessibility${NC}"
FRONTEND_HEALTH=$(curl -s -w "%{http_code}" -o /dev/null "$FRONTEND_URL")
if [ "$FRONTEND_HEALTH" -eq 200 ]; then
  echo -e "${GREEN}✓ Frontend is accessible (HTTP $FRONTEND_HEALTH)${NC}"
else
  echo -e "${RED}✗ Frontend health check failed (HTTP $FRONTEND_HEALTH)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================"
echo "Diagnostic Summary"
echo "========================================${NC}"
echo ""
echo "To verify complete deployment:"
echo "1. Check that all tests show ✓ (green checks)"
echo "2. Verify HTTP 200 responses from health/login endpoints"
echo "3. Confirm CORS headers are present in preflight response"
echo "4. Verify CORS_ORIGINS environment variable is set correctly"
echo ""
echo "Common issues to check:"
echo "- CORS_ORIGINS not set in Render dashboard (ENV VAR)"
echo "- VITE_API_BASE_URL not set in frontend (ENV VAR)"
echo "- DATABASE_URL connection string issues"
echo "- Admin user not seeded in database"
echo "- Backend PORT mismatch (should be 5055 in Render)"
echo ""
echo "View logs:"
echo "  Backend: Render > pds-backend > Logs"
echo "  Frontend Browser: Developer Tools > Console"
echo ""
