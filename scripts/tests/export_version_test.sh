#!/bin/bash

#==============================================================================
# export_version_test.sh
#==============================================================================
# 
# DESCRIPTION:
#   Test suite for export_version.sh script.
#   Validates version extraction, file generation, and error handling.
#
# USAGE:
#   ./scripts/tests/export_version_test.sh [-v|--verbose]
#
# OPTIONS:
#   -v, --verbose    Show verbose test output
#   -h, --help       Show this help message
#
#==============================================================================

# Colors for test output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test settings
VERBOSE=false
PASS=0
FAIL=0

# Help message
show_help() {
    sed -n '/^# DESCRIPTION:/,/^#===/p' "$0" | sed 's/^# \?//'
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Get the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Create a temporary directory for test files
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Source the script (without executing main)
source "$PROJECT_ROOT/scripts/export_version.sh"

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

echo "Running export_version.sh tests..."
echo "--------------------------------"

# Section 1: Command Line Interface
echo -e "\n${BLUE}Testing Command Line Interface${NC}"
test_case "help option" \
    "$PROJECT_ROOT/scripts/export_version.sh --help" \
    "Usage:" \
    true

test_case "unknown option" \
    "$PROJECT_ROOT/scripts/export_version.sh --unknown" \
    "Unknown option" \
    false

# Section 2: Version Extraction
echo -e "\n${BLUE}Testing Version Extraction${NC}"
test_case "go version extraction" \
    "get_go_version" \
    "1.23" \
    true

test_case "toolchain version extraction" \
    "get_toolchain_version" \
    "go1.23.4" \
    true

test_case "syspkg version extraction" \
    "get_syspkg_version" \
    "v0.1.5" \
    true

# Section 3: File Generation
echo -e "\n${BLUE}Testing File Generation${NC}"
test_case "version info file creation" \
    "$PROJECT_ROOT/scripts/export_version.sh" \
    "Version information has been exported" \
    true

test_case "version file format" \
    "grep -E '^GO_VERSION=[0-9]+\.[0-9]+$' $PROJECT_ROOT/.version-info" \
    "GO_VERSION=1.23" \
    true

test_case "JSON file format" \
    "grep -E '\"goVersion\": \"[0-9]+\.[0-9]+\"' $PROJECT_ROOT/.version-info.json" \
    "\"goVersion\": \"1.23\"" \
    true

# Section 4: Error Conditions
echo -e "\n${BLUE}Testing Error Conditions${NC}"
test_case "invalid go.mod" \
    "GO_MOD_PATH=$TEMP_DIR/go.mod $PROJECT_ROOT/scripts/export_version.sh" \
    "Could not read go.mod" \
    false

# Create invalid go.mod for testing
echo "invalid content" > "$TEMP_DIR/go.mod"
test_case "malformed go.mod" \
    "GO_MOD_PATH=$TEMP_DIR/go.mod $PROJECT_ROOT/scripts/export_version.sh" \
    "Failed to parse version" \
    false

# Report results
echo
echo "Test Results:"
echo "Passed: $PASS"
echo "Failed: $FAIL"
exit $FAIL
