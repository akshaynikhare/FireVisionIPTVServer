#!/bin/bash

# FireVision IPTV - Deployment Test Script
# Tests server endpoints after deployment

set -e

# Configuration
SERVER_URL="${SERVER_URL:-https://tv.cadnative.com}"
API_KEY="${API_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_test() {
    echo -e "${YELLOW}Testing: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local extra_args="${4:-}"

    print_test "$name"

    if command -v curl &> /dev/null; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $extra_args "$url")

        if [ "$HTTP_STATUS" = "$expected_status" ]; then
            print_success "$name (HTTP $HTTP_STATUS)"
        else
            print_error "$name (Expected HTTP $expected_status, got $HTTP_STATUS)"
        fi
    else
        print_error "curl not installed"
    fi

    echo ""
}

test_json_response() {
    local name="$1"
    local url="$2"
    local json_key="$3"
    local extra_args="${4:-}"

    print_test "$name"

    if command -v curl &> /dev/null && command -v jq &> /dev/null; then
        RESPONSE=$(curl -s $extra_args "$url")
        VALUE=$(echo "$RESPONSE" | jq -r ".$json_key" 2>/dev/null)

        if [ "$VALUE" != "null" ] && [ -n "$VALUE" ]; then
            print_success "$name: $VALUE"
        else
            print_error "$name (Could not find $json_key in response)"
            echo "Response: $RESPONSE"
        fi
    else
        if ! command -v curl &> /dev/null; then
            print_error "curl not installed"
        fi
        if ! command -v jq &> /dev/null; then
            print_error "jq not installed"
        fi
    fi

    echo ""
}

print_summary() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Test Summary${NC}"
    echo -e "${BLUE}================================${NC}"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        return 1
    fi
}

# Main test execution
main() {
    clear

    print_header "FireVision IPTV Deployment Test"
    echo ""
    echo "Server URL: $SERVER_URL"
    echo ""

    # Check if server URL is accessible
    if ! curl -s --connect-timeout 5 "$SERVER_URL/health" > /dev/null 2>&1; then
        echo -e "${RED}Error: Cannot connect to $SERVER_URL${NC}"
        echo "Please check:"
        echo "  1. Server is running"
        echo "  2. Firewall allows connections"
        echo "  3. Domain DNS is configured correctly"
        exit 1
    fi

    # Test 1: Basic Connectivity
    print_header "1. Basic Connectivity Tests"
    test_endpoint "Health Check" "$SERVER_URL/health" "200"
    test_endpoint "Root Endpoint" "$SERVER_URL/" "200"

    # Test 2: Public API Endpoints
    print_header "2. Public API Endpoints"
    test_endpoint "Get Channels" "$SERVER_URL/api/v1/channels" "200"
    test_endpoint "M3U Playlist" "$SERVER_URL/api/v1/channels/playlist.m3u" "200"
    test_endpoint "App Version Check" "$SERVER_URL/api/v1/app/version?currentVersion=0" "200"

    # Test 3: JSON Response Validation
    print_header "3. JSON Response Validation"
    test_json_response "Health Status" "$SERVER_URL/health" "status"
    test_json_response "MongoDB Connection" "$SERVER_URL/health" "mongodb"
    test_json_response "Channel Count" "$SERVER_URL/api/v1/channels" "count"

    # Test 4: Admin Endpoints (if API key provided)
    if [ -n "$API_KEY" ]; then
        print_header "4. Admin API Tests (with API Key)"
        test_endpoint "Admin Stats" "$SERVER_URL/api/v1/admin/stats" "200" "-H \"X-API-Key: $API_KEY\""
        test_endpoint "Admin Channels List" "$SERVER_URL/api/v1/admin/channels" "200" "-H \"X-API-Key: $API_KEY\""
    else
        print_header "4. Admin API Tests"
        echo -e "${YELLOW}Skipping admin tests (no API key provided)${NC}"
        echo "Set API_KEY environment variable to test admin endpoints:"
        echo "  export API_KEY=your-api-key"
        echo "  ./scripts/test-deployment.sh"
        echo ""
    fi

    # Test 5: Invalid Endpoints (should return 404)
    print_header "5. Error Handling Tests"
    test_endpoint "Non-existent Endpoint (404)" "$SERVER_URL/api/v1/invalid-endpoint" "404"
    test_endpoint "Admin Without Key (401)" "$SERVER_URL/api/v1/admin/stats" "401"

    # Test 6: HTTPS/SSL
    print_header "6. Security Tests"
    if [[ "$SERVER_URL" == https://* ]]; then
        print_test "HTTPS/SSL Configuration"

        if curl -s --head "$SERVER_URL" | grep -q "HTTP/2\|HTTP/1.1"; then
            print_success "HTTPS is working"
        else
            print_error "HTTPS might have issues"
        fi
    else
        echo -e "${YELLOW}Server is using HTTP (not HTTPS)${NC}"
        echo -e "${YELLOW}⚠ Recommended: Setup SSL certificates for production${NC}"
    fi
    echo ""

    # Test 7: Performance Check
    print_header "7. Performance Tests"
    print_test "Response Time"

    if command -v curl &> /dev/null; then
        RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$SERVER_URL/health")
        RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

        if (( $(echo "$RESPONSE_TIME < 1" | bc -l) )); then
            print_success "Response time: ${RESPONSE_TIME_MS}ms (Good)"
        elif (( $(echo "$RESPONSE_TIME < 3" | bc -l) )); then
            print_success "Response time: ${RESPONSE_TIME_MS}ms (Acceptable)"
        else
            print_error "Response time: ${RESPONSE_TIME_MS}ms (Slow)"
        fi
    fi
    echo ""

    # Print summary
    print_summary
}

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "FireVision IPTV Deployment Test Script"
    echo ""
    echo "Usage:"
    echo "  ./scripts/test-deployment.sh"
    echo ""
    echo "Environment Variables:"
    echo "  SERVER_URL  - Server URL to test (default: https://tv.cadnative.com)"
    echo "  API_KEY     - Admin API key for testing admin endpoints (optional)"
    echo ""
    echo "Examples:"
    echo "  # Test default server"
    echo "  ./scripts/test-deployment.sh"
    echo ""
    echo "  # Test local server"
    echo "  SERVER_URL=http://localhost:8009 ./scripts/test-deployment.sh"
    echo ""
    echo "  # Test with admin API key"
    echo "  API_KEY=your-key ./scripts/test-deployment.sh"
    echo ""
    exit 0
fi

# Run tests
main
