#!/bin/bash

# Configuration
PORT=3000
BASE_URL="http://localhost:$PORT"
USER_ID="john_doe"

echo "Running End-to-End Tests for User Payout Management System..."
echo "Assuming server is running on $BASE_URL"
echo "---------------------------------------------------------"

TOTAL=0
PASSED=0
FAILED=0

# Helper to print test result
assert() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  
  ((TOTAL++))
  if [ "$expected" == "$actual" ]; then
    echo "PASS: $name"
    ((PASSED++))
  else
    echo "FAIL: $name - expected '$expected', got '$actual'"
    ((FAILED++))
  fi
}

# Helper to extract JSON fields using Node (guaranteed to be installed)
extract_json() {
  local field="$1"
  node -e "
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      try {
        const json = JSON.parse(data);
        const value = '$field'.split('.').reduce((acc, key) => acc && acc[key], json);
        console.log(value !== undefined ? value : '');
      } catch (e) {
        console.log('');
      }
    });
  "
}

# 3a. GET seeded user's balance
echo "Test 3a: GET seeded user's balance"
BALANCE=$(curl -s "$BASE_URL/users/$USER_ID/balance" | extract_json "withdrawableBalance")
assert "Seeded balance matches ₹68" "68" "$BALANCE"

# 3b. Create new pending sale, run advance payout, confirm 10% advance
echo "Test 3b: Create pending sale & run advance"
USER_ID_2="test_user_$(date +%s)"
SALE_RESP=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{\"userId\": \"$USER_ID_2\", \"brand\": \"brand_2\", \"status\": \"pending\", \"earnings\": 100}")
SALE_ID=$(echo "$SALE_RESP" | extract_json "id")

curl -s -X POST "$BASE_URL/payouts/advance/run" > /dev/null
BALANCE_2=$(curl -s "$BASE_URL/users/$USER_ID_2/balance" | extract_json "withdrawableBalance")
assert "Advance payout created (10% of 100 = 10)" "10" "$BALANCE_2"

# 3c. Run advance job again, confirm idempotency
echo "Test 3c: Advance job idempotency"
ADVANCE_RESP=$(curl -s -X POST "$BASE_URL/payouts/advance/run" -H "Content-Type: application/json")
PROCESSED=$(echo "$ADVANCE_RESP" | extract_json "processedCount")
assert "No duplicate advances created" "0" "$PROCESSED"
BALANCE_3=$(curl -s "$BASE_URL/users/$USER_ID_2/balance" | extract_json "withdrawableBalance")
assert "Balance remained the same after duplicate run" "10" "$BALANCE_3"

# 3d. Reconcile sale as 'approved'
echo "Test 3d: Reconcile as approved"
curl -s -X POST "$BASE_URL/sales/$SALE_ID/reconcile" -H "Content-Type: application/json" -d "{\"status\": \"approved\"}" > /dev/null
BALANCE_4=$(curl -s "$BASE_URL/users/$USER_ID_2/balance" | extract_json "withdrawableBalance")
assert "Ledger reflects earnings minus advance (100 - 10 + 10 = 100)" "100" "$BALANCE_4"

# 3e. Attempt to reconcile SAME sale again
echo "Test 3e: Double reconcile rejection"
RECONCILE_ERR=$(curl -s -X POST "$BASE_URL/sales/$SALE_ID/reconcile" -H "Content-Type: application/json" -d "{\"status\": \"rejected\"}" | extract_json "error")
assert "Double reconcile is rejected" "Sale is already reconciled" "$RECONCILE_ERR"

# 3f. Create & advance second sale, reconcile as rejected
echo "Test 3f: Reconcile as rejected"
SALE_2_RESP=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{\"userId\": \"$USER_ID_2\", \"brand\": \"brand_3\", \"status\": \"pending\", \"earnings\": 50}")
SALE_2_ID=$(echo "$SALE_2_RESP" | extract_json "id")
curl -s -X POST "$BASE_URL/payouts/advance/run" > /dev/null
curl -s -X POST "$BASE_URL/sales/$SALE_2_ID/reconcile" -H "Content-Type: application/json" -d "{\"status\": \"rejected\"}" > /dev/null
BALANCE_5=$(curl -s "$BASE_URL/users/$USER_ID_2/balance" | extract_json "withdrawableBalance")
assert "Rejected sale applies negative adjustment (100 balance + 5 advance - 5 adjustment = 100)" "100" "$BALANCE_5"

# 3g. Successfully request one withdrawal
echo "Test 3g: Request withdrawal"
WITHDRAW_RESP=$(curl -s -X POST "$BASE_URL/withdrawals" -H "Content-Type: application/json" -d "{\"userId\": \"$USER_ID_2\", \"amount\": 40}")
WITHDRAW_STATUS=$(echo "$WITHDRAW_RESP" | extract_json "status")
WITHDRAW_ID=$(echo "$WITHDRAW_RESP" | extract_json "id")
assert "Withdrawal successful" "completed" "$WITHDRAW_STATUS"
BALANCE_6=$(curl -s "$BASE_URL/users/$USER_ID_2/balance" | extract_json "withdrawableBalance")
assert "Balance reduced after withdrawal (100 - 40 = 60)" "60" "$BALANCE_6"

# 3h. Attempt second withdrawal immediately
echo "Test 3h: 24-hour withdrawal cooldown"
WITHDRAW_ERR=$(curl -s -X POST "$BASE_URL/withdrawals" -H "Content-Type: application/json" -d "{\"userId\": \"$USER_ID_2\", \"amount\": 20}" | extract_json "error")
assert "Second withdrawal rejected for cooldown" "You can only make one withdrawal every 24 hours" "$WITHDRAW_ERR"

# 3i. Attempt withdrawal exceeding balance
echo "Test 3i: Insufficient funds"
# Need to use a different user to avoid 24h cooldown hitting first
USER_ID_3="test_user_$(date +%s)_3"
curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{\"userId\": \"$USER_ID_3\", \"brand\": \"brand_4\", \"status\": \"pending\", \"earnings\": 20}" > /dev/null
curl -s -X POST "$BASE_URL/payouts/advance/run" > /dev/null
WITHDRAW_FUNDS_ERR=$(curl -s -X POST "$BASE_URL/withdrawals" -H "Content-Type: application/json" -d "{\"userId\": \"$USER_ID_3\", \"amount\": 100}" | extract_json "error")
assert "Withdrawal rejected for insufficient balance" "Insufficient balance" "$WITHDRAW_FUNDS_ERR"

# 3j. Mark withdrawal as failed, confirm balance restored
echo "Test 3j: Mark withdrawal as failed"
FAIL_RESP=$(curl -s -X POST "$BASE_URL/withdrawals/$WITHDRAW_ID/fail" -H "Content-Type: application/json" -d "{\"reason\": \"failed\"}")
FAIL_STATUS=$(echo "$FAIL_RESP" | extract_json "status")
assert "Withdrawal marked as failed" "failed" "$FAIL_STATUS"

BALANCE_7=$(curl -s "$BASE_URL/users/$USER_ID_2/balance" | extract_json "withdrawableBalance")
assert "Balance restored after failure (60 + 40 = 100)" "100" "$BALANCE_7"

echo "---------------------------------------------------------"
echo "TOTAL: $TOTAL"
echo "PASSED: $PASSED"
echo "FAILED: $FAILED"

if [ "$FAILED" -gt 0 ]; then
  exit 1
else
  exit 0
fi
