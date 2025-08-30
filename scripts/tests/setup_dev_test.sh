#!/bin/bash

#==============================================================================
# setup_dev_test.sh
#==============================================================================
# 
# DESCRIPTION:
#   Test suite for setup_dev.sh script.
#   Validates development environment setup, tool installation, and configuration.
#
# USAGE:
#   ./scripts/tests/setup_dev_test.sh [-v|--verbose] [-s|--skip-install]
#
# OPTIONS:
#   -v, --verbose       Show verbose test output
#   -h, --help         Show this help message
#   -s, --skip-install Skip actual installation tests
#
#==============================================================================

# Source the test library
source "$(dirname "$0")/test_lib.sh"

# Additional settings
SKIP_INSTALL=false

# Parse arguments (handle any unprocessed args from common parser)
while [[ -n "$1" ]]; do
    arg="$(parse_common_args "$1")"
    case "$arg" in
        -s|--skip-install)
            SKIP_INSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            generate_help "$0"
            exit 1
            ;;
    esac
    shift
done

# Initialize test environment
setup_test_env

# Get the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Create a temporary directory for test files
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Main test case function
function test_case() {
    local name=$1
    local cmd=$2
    local expected_output=$3
    local should_succeed=${4:-true}

    echo -n "Testing $name... "

    # Run command and capture output
    local output
    if [[ $should_succeed == "true" ]]; then
        output=$($cmd 2>&1)
        local status=$?
        if [[ $status -eq 0 && $output == *"$expected_output"* ]]; then
            echo -e "${GREEN}PASS${NC}"
            ((PASS++))
            return 0
        fi
    else
        output=$($cmd 2>&1) || true
        if [[ $output == *"$expected_output"* ]]; then
            echo -e "${GREEN}PASS${NC}"
            ((PASS++))
            return 0
        fi
    fi

    echo -e "${RED}FAIL${NC}"
    echo "  Expected output to contain: '$expected_output'"
    echo "  Got: '$output'"
    ((FAIL++))
    return 0
}

echo "Running setup_dev.sh tests..."
echo "---------------------------"

# Section 1: Command Line Interface
print_section "Testing Command Line Interface"
test_case "help option" \
    "$PROJECT_ROOT/scripts/setup_dev.sh --help" \
    "Usage:" \
    true

test_case "unknown option" \
    "$PROJECT_ROOT/scripts/setup_dev.sh --unknown" \
    "Unknown option" \
    false

# Section 2: Go Environment Check
print_section "Testing Go Environment"
test_case "go installation" \
    "command -v go" \
    "" \
    true

test_case "go version format" \
    "go version" \
    "go version go1" \
    true

test_case "go modules enabled" \
    "go env GO111MODULE" \
    "on" \
    true

# Section 3: Development Tool Installation
print_section "Testing Development Tools"
test_case "doctoc installation check" \
    "command -v doctoc" \
    "" \
    true

test_case "trunk installation check" \
    "command -v trunk" \
    "" \
    true

if [[ "$SKIP_INSTALL" == "false" ]]; then
    test_case "doctoc functionality" \
        "doctoc --version" \
        "doctoc@" \
        true

    test_case "trunk functionality" \
        "trunk --version" \
        "trunk" \
        true
fi

# Section 4: Project Configuration
print_section "Testing Project Configuration"
test_case "go.mod existence" \
    "test -f $PROJECT_ROOT/go.mod" \
    "" \
    true

test_case "trunk.yaml existence" \
    "test -f $PROJECT_ROOT/.trunk/trunk.yaml" \
    "" \
    true

# Section 5: Error Conditions
print_section "Testing Error Conditions"
test_case "invalid GOPATH" \
    "GOPATH=/nonexistent $PROJECT_ROOT/scripts/setup_dev.sh" \
    "Invalid GOPATH" \
    false

if [[ "$SKIP_INSTALL" == "false" ]]; then
    test_case "network failure simulation" \
        "SIMULATE_NETWORK_FAILURE=1 $PROJECT_ROOT/scripts/setup_dev.sh" \
        "Failed to download" \
        false
fi

# Report test results and exit with appropriate status
report_results

# Report results
echo
echo "Test Results:"
echo "Passed: $PASS"
echo "Failed: $FAIL"
exit $FAIL
