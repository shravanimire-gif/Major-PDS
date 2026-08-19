#!/usr/bin/env bash
# ============================================================
# E2E Transaction Flow Test — Test Case 1: Successful Ration Distribution
# ============================================================
set -euo pipefail

BASE="http://localhost:5000"
PASS=0
FAIL=0
WARN=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✔ PASS${NC} — $1"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ FAIL${NC} — $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}  ⚠ WARN${NC} — $1"; ((WARN++)); }
sep()  { echo -e "\n${CYAN}══════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}══════════════════════════════════════════${NC}"; }

# ── helpers ──────────────────────────────────────────────────
post() { curl -sf -X POST -H "Content-Type: application/json" "${@}"; }
get()  { curl -sf -X GET  -H "Content-Type: application/json" "${@}"; }
jq_val() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null || echo ""; }

sep "STEP 1 — Admin Login"
ADMIN_RESP=$(post "$BASE/auth/login" -d '{"email":"admin@pds.gov","password":"admin123"}') || { fail "Admin login HTTP error"; exit 1; }
ADMIN_TOKEN=$(jq_val "$ADMIN_RESP" "['token']")
[ -n "$ADMIN_TOKEN" ] && ok "Admin login → token received" || { fail "Admin login → no token in response: $ADMIN_RESP"; exit 1; }

sep "STEP 2 — Shopkeeper Login (ajay.wankhede@pds.gov)"
SK_RESP=$(post "$BASE/auth/login" -d '{"email":"ajay.wankhede@pds.gov","password":"password123"}') || { fail "Shopkeeper login HTTP error: check password"; exit 1; }
SK_TOKEN=$(jq_val "$SK_RESP" "['token']")
[ -n "$SK_TOKEN" ] && ok "Shopkeeper login → token received" || { fail "Shopkeeper login → no token: $SK_RESP"; exit 1; }

sep "STEP 3 — Shopkeeper /me (verify shop assignment)"
SK_ME=$(get "$BASE/api/shopkeeper/me" -H "Authorization: Bearer $SK_TOKEN") || { fail "GET /shopkeeper/me HTTP error"; exit 1; }
SHOP_NAME=$(jq_val "$SK_ME" "['shop']['name']")
TODAY_TX=$(jq_val "$SK_ME" "['today_transactions']")
[ -n "$SHOP_NAME" ] && ok "Shopkeeper assigned to shop: $SHOP_NAME" || fail "No shop assigned to shopkeeper"
echo "    today_transactions=$TODAY_TX"

sep "STEP 4 — Beneficiary OTP Send (mobile: 9604686258)"
OTP_SEND=$(post "$BASE/auth/otp/send" -d '{"mobile":"9604686258"}') || { fail "OTP send HTTP error"; exit 1; }
OTP_MSG=$(jq_val "$OTP_SEND" "['message']")
[ -n "$OTP_MSG" ] && ok "OTP send → $OTP_MSG" || fail "OTP send failed: $OTP_SEND"

sep "STEP 4b — Enter OTP (sent to 9604686258)"
read -r -p "  Enter OTP received on 9604686258: " OTP_CODE
VERIFY_RESP=$(post "$BASE/auth/otp/verify" -d "{\"mobile\":\"9604686258\",\"otp\":\"$OTP_CODE\"}") || { fail "OTP verify HTTP error"; exit 1; }
BEN_TOKEN=$(jq_val "$VERIFY_RESP" "['token']")
BEN_USER_ID=$(jq_val "$VERIFY_RESP" "['user']['id']")
[ -n "$BEN_TOKEN" ] && ok "OTP verified → beneficiary token received" || { fail "OTP verify failed: $VERIFY_RESP"; exit 1; }
echo "    beneficiary_user_id=$BEN_USER_ID"

sep "STEP 5 — Beneficiary /me"
BEN_ME=$(get "$BASE/api/beneficiary/me" -H "Authorization: Bearer $BEN_TOKEN") || { fail "GET /beneficiary/me HTTP error"; exit 1; }
CARD_NUM=$(jq_val "$BEN_ME" "['beneficiary']['card_number']")
RC_ID=$(jq_val "$BEN_ME" "['beneficiary']['ration_card_id']")
[ -n "$CARD_NUM" ] && ok "Beneficiary profile → card: $CARD_NUM" || fail "Beneficiary /me failed: $BEN_ME"

sep "STEP 6 — Beneficiary Wallet (pre-transaction balance)"
WALLET_RESP=$(get "$BASE/api/beneficiary/wallet" -H "Authorization: Bearer $BEN_TOKEN") || { fail "GET /beneficiary/wallet HTTP error"; exit 1; }
PRE_RICE=$(jq_val "$WALLET_RESP" "['wallet']['rice_balance_kg']")
PRE_WHEAT=$(jq_val "$WALLET_RESP" "['wallet']['wheat_balance_kg']")
[ -n "$PRE_RICE" ] && ok "Pre-transaction wallet → rice=$PRE_RICE, wheat=$PRE_WHEAT" || fail "Wallet fetch failed: $WALLET_RESP"

sep "STEP 7 — Beneficiary Family Members"
FAM_RESP=$(get "$BASE/api/beneficiary/family" -H "Authorization: Bearer $BEN_TOKEN") || { fail "GET /beneficiary/family HTTP error"; exit 1; }
FAM_COUNT=$(echo "$FAM_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['family']))" 2>/dev/null || echo "0")
[ "$FAM_COUNT" -gt 0 ] && ok "Family members returned: $FAM_COUNT member(s)" || warn "No family members found"

sep "STEP 8 — Generate QR Session"
QR_RESP=$(post "$BASE/api/beneficiary/qr-session" -H "Authorization: Bearer $BEN_TOKEN" -d '{}') || { fail "POST /beneficiary/qr-session HTTP error"; exit 1; }
SESSION_ID=$(jq_val "$QR_RESP" "['sessionId']")
QR_RC_ID=$(jq_val "$QR_RESP" "['rationCardId']")
EXPIRES_AT=$(jq_val "$QR_RESP" "['expiresAt']")
[ -n "$SESSION_ID" ] && ok "QR session created → sessionId=${SESSION_ID:0:16}..." || { fail "QR session creation failed: $QR_RESP"; exit 1; }
echo "    ration_card_id=$QR_RC_ID"
echo "    expires_at=$EXPIRES_AT"

sep "STEP 9 — Verify QR Session in DB"
DB_SESSION=$(psql -d newpds -t -c "SELECT session_id, is_used, expires_at FROM qr_sessions WHERE session_id='$SESSION_ID' LIMIT 1;" 2>&1 | xargs)
[ -n "$DB_SESSION" ] && ok "QR session exists in DB: $DB_SESSION" || fail "QR session NOT found in DB"

sep "STEP 10 — Shopkeeper Scans QR (GET /shopkeeper/beneficiary/:id)"
SCAN_RESP=$(get "$BASE/api/shopkeeper/beneficiary/$QR_RC_ID?sessionId=$SESSION_ID&beneficiary_user_id=$BEN_USER_ID" \
  -H "Authorization: Bearer $SK_TOKEN") || { fail "GET /shopkeeper/beneficiary/:id HTTP error — raw: $(curl -s "$BASE/api/shopkeeper/beneficiary/$QR_RC_ID?sessionId=$SESSION_ID&beneficiary_user_id=$BEN_USER_ID" -H "Authorization: Bearer $SK_TOKEN")"; exit 1; }

BEN_NAME=$(jq_val "$SCAN_RESP" "['beneficiary']['name']")
BEN_CARD=$(jq_val "$SCAN_RESP" "['beneficiary']['card_number']")
BEN_CAT=$(jq_val "$SCAN_RESP" "['beneficiary']['category']")
BEN_FAM=$(jq_val "$SCAN_RESP" "['beneficiary']['family_size']")
SCAN_RICE=$(jq_val "$SCAN_RESP" "['wallet']['rice_balance_kg']")
SCAN_WHEAT=$(jq_val "$SCAN_RESP" "['wallet']['wheat_balance_kg']")

[ -n "$BEN_NAME" ]  && ok "Beneficiary name displayed: $BEN_NAME"   || fail "Beneficiary name missing"
[ -n "$BEN_CARD" ]  && ok "Card number displayed: $BEN_CARD"         || fail "Card number missing"
[ -n "$BEN_CAT" ]   && ok "Category displayed: $BEN_CAT"             || fail "Category missing"
[ -n "$BEN_FAM" ]   && ok "Family size displayed: $BEN_FAM"          || fail "Family size missing"
[ -n "$SCAN_RICE" ] && ok "Wallet displayed → rice=$SCAN_RICE, wheat=$SCAN_WHEAT" || fail "Wallet balance missing"

sep "STEP 11 — Confirm Distribution (POST /shopkeeper/dispense)"
RICE_DISPENSE=5
WHEAT_DISPENSE=3

DISPENSE_BODY=$(cat <<EOF
{
  "ration_card_id": "$QR_RC_ID",
  "session_id": "$SESSION_ID",
  "beneficiary_user_id": "$BEN_USER_ID",
  "rice_qty_kg": $RICE_DISPENSE,
  "wheat_qty_kg": $WHEAT_DISPENSE
}
EOF
)

DISP_RESP=$(post "$BASE/api/shopkeeper/dispense" -H "Authorization: Bearer $SK_TOKEN" -d "$DISPENSE_BODY") \
  || { DISP_ERR=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $SK_TOKEN" "$BASE/api/shopkeeper/dispense" -d "$DISPENSE_BODY"); fail "POST /shopkeeper/dispense HTTP error: $DISP_ERR"; exit 1; }

DISP_MSG=$(jq_val "$DISP_RESP" "['message']")
TX_ID=$(jq_val "$DISP_RESP" "['transaction']['id']")
REM_RICE=$(jq_val "$DISP_RESP" "['remaining_wallet']['rice_balance_kg']")
REM_WHEAT=$(jq_val "$DISP_RESP" "['remaining_wallet']['wheat_balance_kg']")

[ "$DISP_MSG" = "Dispensed successfully" ] && ok "Dispense response: $DISP_MSG" || fail "Unexpected dispense message: $DISP_MSG"
[ -n "$TX_ID" ] && ok "Transaction ID created: $TX_ID" || fail "No transaction ID in response"

sep "STEP 12 — Verify Wallet Deduction"
EXP_RICE=$(python3 -c "print($PRE_RICE - $RICE_DISPENSE)")
EXP_WHEAT=$(python3 -c "print($PRE_WHEAT - $WHEAT_DISPENSE)")

if [ "$REM_RICE" = "$EXP_RICE" ] && [ "$REM_WHEAT" = "$EXP_WHEAT" ]; then
  ok "Wallet correctly reduced → rice=$REM_RICE (was $PRE_RICE), wheat=$REM_WHEAT (was $PRE_WHEAT)"
else
  fail "Wallet mismatch → expected rice=$EXP_RICE wheat=$EXP_WHEAT, got rice=$REM_RICE wheat=$REM_WHEAT"
fi

sep "STEP 13 — Verify Transaction in DB"
DB_TX=$(psql -d newpds -t -c "SELECT id, rice_qty_kg, wheat_qty_kg, created_at FROM transactions WHERE id='$TX_ID' LIMIT 1;" 2>&1 | xargs)
[ -n "$DB_TX" ] && ok "Transaction in DB: $DB_TX" || fail "Transaction NOT found in DB"

sep "STEP 14 — Verify QR Session Marked as Used"
DB_USED=$(psql -d newpds -t -c "SELECT is_used, used_at FROM qr_sessions WHERE session_id='$SESSION_ID' LIMIT 1;" 2>&1 | xargs)
echo "$DB_USED" | grep -q "t" && ok "QR session marked as used: $DB_USED" || fail "QR session NOT marked as used: $DB_USED"

sep "STEP 15 — Beneficiary Wallet Post-Transaction (via API)"
POST_WALLET=$(get "$BASE/api/beneficiary/wallet" -H "Authorization: Bearer $BEN_TOKEN") || { fail "POST-transaction wallet fetch failed"; exit 1; }
POST_RICE=$(jq_val "$POST_WALLET" "['wallet']['rice_balance_kg']")
POST_WHEAT=$(jq_val "$POST_WALLET" "['wallet']['wheat_balance_kg']")
[ "$POST_RICE" = "$EXP_RICE" ] && ok "Beneficiary dashboard reflects updated rice: $POST_RICE" || fail "Beneficiary dashboard rice mismatch: got $POST_RICE expected $EXP_RICE"
[ "$POST_WHEAT" = "$EXP_WHEAT" ] && ok "Beneficiary dashboard reflects updated wheat: $POST_WHEAT" || fail "Beneficiary dashboard wheat mismatch: got $POST_WHEAT expected $EXP_WHEAT"

sep "STEP 16 — Transaction History (Beneficiary)"
TX_HIST=$(get "$BASE/api/beneficiary/transactions" -H "Authorization: Bearer $BEN_TOKEN") || { fail "GET /beneficiary/transactions HTTP error"; exit 1; }
TX_COUNT=$(echo "$TX_HIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['transactions']))" 2>/dev/null || echo "0")
LATEST_TX_ID=$(echo "$TX_HIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['transactions'][0]['id'] if d['transactions'] else '')" 2>/dev/null || echo "")
[ "$TX_COUNT" -gt 0 ] && ok "Transaction history returned $TX_COUNT record(s)" || fail "No transactions in history"
[ "$LATEST_TX_ID" = "$TX_ID" ] && ok "Latest transaction matches: $LATEST_TX_ID" || warn "Latest tx id mismatch: got $LATEST_TX_ID, expected $TX_ID"

sep "STEP 17 — Duplicate Transaction Prevention"
DUP_RESP=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $SK_TOKEN" \
  "$BASE/api/shopkeeper/dispense" -d "$DISPENSE_BODY")
DUP_ERR=$(jq_val "$DUP_RESP" "['error']")
if echo "$DUP_ERR" | grep -qi "already claimed\|already used\|session already used"; then
  ok "Duplicate blocked correctly: $DUP_ERR"
else
  fail "Duplicate NOT blocked — response: $DUP_RESP"
fi

sep "STEP 18 — Duplicate QR Reuse Prevention"
NEW_SESSION=$(post "$BASE/api/beneficiary/qr-session" -H "Authorization: Bearer $BEN_TOKEN" -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sessionId',''))" 2>/dev/null || echo "")
if [ -n "$NEW_SESSION" ]; then
  DUP_QR_RESP=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $SK_TOKEN" \
    "$BASE/api/shopkeeper/dispense" -d "{\"ration_card_id\":\"$QR_RC_ID\",\"session_id\":\"$NEW_SESSION\",\"beneficiary_user_id\":\"$BEN_USER_ID\",\"rice_qty_kg\":2,\"wheat_qty_kg\":1}")
  DUP_QR_ERR=$(jq_val "$DUP_QR_RESP" "['error']")
  echo "$DUP_QR_ERR" | grep -qi "already claimed" && ok "Monthly re-claim blocked: $DUP_QR_ERR" || warn "Monthly re-claim check: $DUP_QR_RESP"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  TEST SUMMARY${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}   ${RED}FAIL: $FAIL${NC}   ${YELLOW}WARN: $WARN${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}  ✗ Some tests FAILED — see above${NC}"
  exit 1
else
  echo -e "${GREEN}  ✔ All tests PASSED${NC}"
  exit 0
fi
