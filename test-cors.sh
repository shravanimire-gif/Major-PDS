#!/bin/bash

# CORS Testing Script
# Run this script to verify CORS is working correctly in production

# Configuration
BACKEND_URL="${1:-http://localhost:3000}"  # Default to localhost if not provided
FRONTEND_ORIGIN="https://major-project-1-sdbw.onrender.com"

echo "=========================================="
echo "CORS Configuration Test"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo "Frontend Origin: $FRONTEND_ORIGIN"
echo ""

# Test 1: Check /debug/cors endpoint
echo "Test 1: Retrieve CORS Debug Info"
echo "Command: curl $BACKEND_URL/debug/cors"
echo "---"
curl -s "$BACKEND_URL/debug/cors" | jq '.' 2>/dev/null || curl -s "$BACKEND_URL/debug/cors"
echo ""
echo ""

# Test 2: Preflight OPTIONS request
echo "Test 2: Preflight OPTIONS Request"
echo "Testing OPTIONS request with frontend origin..."
echo "---"
curl -X OPTIONS "$BACKEND_URL/api/beneficiary/register" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -w "\n\nResponse Status: %{http_code}\n\n" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control|Origin:|Request-Method:|Request-Headers:)" || \
  echo "Use curl with -v flag to see headers"
echo ""

# Test 3: Health check with origin header
echo "Test 3: Health Check with Origin Header"
echo "Command: curl -H 'Origin: $FRONTEND_ORIGIN' $BACKEND_URL/health"
echo "---"
curl -s -H "Origin: $FRONTEND_ORIGIN" "$BACKEND_URL/health" | jq '.' 2>/dev/null || \
  curl -s -H "Origin: $FRONTEND_ORIGIN" "$BACKEND_URL/health"
echo ""
echo ""

# Test 4: Detailed preflight with headers output
echo "Test 4: Detailed Preflight Headers"
echo "---"
echo "Request Headers:"
echo "  Origin: $FRONTEND_ORIGIN"
echo "  Access-Control-Request-Method: POST"
echo "  Access-Control-Request-Headers: Content-Type,Authorization"
echo ""
echo "Response Headers:"
curl -s -i -X OPTIONS "$BACKEND_URL/api/auth/login" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" 2>/dev/null | \
  grep -E "^(HTTP|Access-Control|Date|Content|Vary)" || \
  echo "Note: Use 'curl -i' to view all response headers"
echo ""
echo ""

# Test 5: Check what origins are allowed
echo "Test 5: Testing Different Origins"
echo "---"
for origin in "http://localhost:3000" "http://localhost:5173" "$FRONTEND_ORIGIN"; do
  echo "Testing Origin: $origin"
  status=$(curl -s -w "%{http_code}" -o /dev/null -X OPTIONS "$BACKEND_URL/api/health" \
    -H "Origin: $origin")
  echo "  Response Status: $status"
  echo ""
done

echo "=========================================="
echo "Testing Complete"
echo "=========================================="
echo ""
echo "Expected Results:"
echo "✓ Test 1: Should show nodeEnv, corsOriginsEnv, and allowedOrigins"
echo "✓ Test 2: Should get 204 response with Access-Control headers"
echo "✓ Test 3: Should get 200 with Access-Control-Allow-Origin header"
echo "✓ Test 4: Should show CORS headers in response"
echo "✓ Test 5: Render origin should return 204, others depend on environment"
echo ""
