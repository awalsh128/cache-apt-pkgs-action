#!/bin/bash

#==============================================================================
# test_lib.sh
#==============================================================================
# 
# DESCRIPTION:
#   Common testing library for shell script tests.
#   Provides standard test framework functions and utilities.
#
# USAGE:
#   source "$(dirname "$0")/test_lib.sh"
#
# FEATURES:
#   - Standard test framework
#   - Color output
#   - Test counting
#   - Temporary directory management
#   - Command line parsing
#   - Help text generation
#
#==============================================================================

# Colors for test output
export GREEN='\033[0;32m'
export RED='\033[0;31m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color
export BOLD='\033[1m'

# Test counters
export PASS=0
export FAIL=0

# Test settings
export VERBOSE=${VERBOSE:-false}
export TEMP_DIR

# Print functions
print_header() {
    echo -e "\n${BOLD}${1}${NC}\n"
}

print_section() {
    echo -e "\n${BLUE}${1}${NC}"
}

print_info() {
    [[ "$VERBOSE" == "true" ]] && echo "INFO: $1"
}

# Main test case function
test_case() {
    local name=$1
    local cmd=$2
    local expected_output=$3
    local should_succeed=${4:-true}

    echo -n "Testing $name... "
    print_info "Command: $cmd"

    # Run command and capture output
    local output
    if [[ $should_succeed == "true" ]]; then
        output=$($cmd 2>&1)
        local status=$?
        if [[ $status -eq 0 && $output == *"$expected_output"* ]]; then
            echo -e "${GREEN}PASS${NC}"
            ((PASS++))
            print_info "Output: $output"
            return 0
        fi
    else
        output=$($cmd 2>&1) || true
        if [[ $output == *"$expected_output"* ]]; then
            echo -e "${GREEN}PASS${NC}"
            ((PASS++))
            print_info "Output: $output"
            return 0
        fi
    fi

    echo -e "${RED}FAIL${NC}"
    echo "  Expected output to contain: '$expected_output'"
    echo "  Got: '$output'"
    ((FAIL++))
    return 0
}

# Setup functions
setup_test_env() {
    TEMP_DIR=$(mktemp -d)
    trap cleanup_test_env EXIT
    print_info "Created temporary directory: $TEMP_DIR"
}

cleanup_test_env() {
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
        print_info "Cleaned up temporary directory: $TEMP_DIR"
    fi
}

# Help text generation
generate_help() {
    local script_path=$1
    sed -n '/^# DESCRIPTION:/,/^#===/p' "$script_path" | sed 's/^# \?//'
}

# Standard argument parsing
parse_common_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                generate_help "$0"
                exit 0
                ;;
            *)
                # Return the unhandled argument
                echo "$1"
                ;;
        esac
        shift
    done
}

# Results reporting
report_results() {
    echo
    echo "Test Results:"
    echo "------------"
    echo "Passed: $PASS"
    echo "Failed: $FAIL"
    echo "Total:  $((PASS + FAIL))"
    
    # Return non-zero if any tests failed
    [[ $FAIL -eq 0 ]]
}

# File operation helpers
create_test_file() {
    local file="$1"
    local content="$2"
    local mode="${3:-644}"
    
    mkdir -p "$(dirname "$file")"
    echo "$content" > "$file"
    chmod "$mode" "$file"
    print_info "Created test file: $file"
}

create_test_dir() {
    local dir="$1"
    local mode="${2:-755}"
    
    mkdir -p "$dir"
    chmod "$mode" "$dir"
    print_info "Created test directory: $dir"
}

assert_file_contains() {
    local file="$1"
    local pattern="$2"
    local message="${3:-File does not contain expected content}"
    
    if ! grep -q "$pattern" "$file"; then
        echo -e "${RED}FAIL${NC}: $message"
        echo "  File: $file"
        echo "  Expected pattern: $pattern"
        echo "  Content:"
        cat "$file"
        return 1
    fi
    return 0
}

assert_file_exists() {
    local file="$1"
    local message="${2:-File does not exist}"
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}FAIL${NC}: $message"
        echo "  Expected file: $file"
        return 1
    fi
    return 0
}

assert_dir_exists() {
    local dir="$1"
    local message="${2:-Directory does not exist}"
    
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}FAIL${NC}: $message"
        echo "  Expected directory: $dir"
        return 1
    fi
    return 0
}

is_command_available() {
    command -v "$1" >/dev/null 2>&1
}

wait_for_condition() {
    local cmd="$1"
    local timeout="${2:-10}"
    local interval="${3:-1}"
    
    local end_time=$((SECONDS + timeout))
    while [[ $SECONDS -lt $end_time ]]; do
        if eval "$cmd"; then
            return 0
        fi
        sleep "$interval"
    done
    return 1
}

skip_if_command_missing() {
    local cmd="$1"
    local message="${2:-Required command not available}"
    
    if ! is_command_available "$cmd"; then
        echo "SKIP: $message (missing: $cmd)"
        return 0
    fi
    return 1
}

run_if_exists() {
    local cmd="$1"
    local fallback="$2"
    
    if is_command_available "$cmd"; then
        "$cmd"
    else
        eval "$fallback"
    fi
}

backup_and_restore() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cp "$file" "${file}.bak"
        print_info "Backed up: $file"
        trap 'restore_backup "$file"' EXIT
    fi
}

restore_backup() {
    local file="$1"
    if [[ -f "${file}.bak" ]]; then
        mv "${file}.bak" "$file"
        print_info "Restored: $file"
    fi
}

check_dependencies() {
    local missing=0
    for cmd in "$@"; do
        if ! is_command_available "$cmd"; then
            echo "Missing required dependency: $cmd"
            ((missing++))
        fi
    done
    return $missing
}
