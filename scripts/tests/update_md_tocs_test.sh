#!/bin/bash

#==============================================================================
# update_md_tocs_test.sh
#==============================================================================
# 
# DESCRIPTION:
#   Test suite for update_md_tocs.sh script.
#   Validates Table of Contents generation, markdown file handling, 
#   and doctoc integration.
#
# USAGE:
#   ./scripts/tests/update_md_tocs_test.sh [-v|--verbose] [-s|--skip-doctoc]
#
# OPTIONS:
#   -v, --verbose     Show verbose test output
#   -s, --skip-doctoc Skip tests requiring doctoc installation
#   -h, --help        Show this help message
#
#==============================================================================

# Colors for test output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test settings
VERBOSE=false
SKIP_DOCTOC=false
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
        -s|--skip-doctoc)
            SKIP_DOCTOC=true
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

# Test helper functions
create_test_md() {
    local file="$1"
    cat > "$file" << EOF
# Test Document

<!-- START doctoc -->
<!-- END doctoc -->

## Section 1
### Subsection 1.1
### Subsection 1.2

## Section 2
### Subsection 2.1
EOF
}

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

echo "Running update_md_tocs.sh tests..."
echo "---------------------------------"

# Section 1: Command Line Interface
echo -e "\n${BLUE}Testing Command Line Interface${NC}"
test_case "help option" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh --help" \
    "Usage:" \
    true

test_case "unknown option" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh --unknown" \
    "Unknown option" \
    false

# Section 2: Basic TOC Generation
echo -e "\n${BLUE}Testing Basic TOC Generation${NC}"
create_test_md "$TEMP_DIR/test.md"

if [[ "$SKIP_DOCTOC" == "false" ]]; then
    test_case "doctoc installation" \
        "command -v doctoc" \
        "" \
        true

    test_case "TOC generation" \
        "doctoc '$TEMP_DIR/test.md'" \
        "Table of Contents" \
        true

    test_case "TOC structure" \
        "grep -A 5 'Table of Contents' '$TEMP_DIR/test.md'" \
        "Section 1" \
        true
fi

# Section 3: Multiple File Handling
echo -e "\n${BLUE}Testing Multiple File Handling${NC}"
create_test_md "$TEMP_DIR/doc1.md"
create_test_md "$TEMP_DIR/doc2.md"

test_case "multiple file update" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh '$TEMP_DIR/doc1.md' '$TEMP_DIR/doc2.md'" \
    "updated" \
    true

# Section 4: Special Cases
echo -e "\n${BLUE}Testing Special Cases${NC}"
# Create file without TOC markers
cat > "$TEMP_DIR/no_toc.md" << EOF
# Document
## Section 1
## Section 2
EOF

test_case "file without TOC markers" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh '$TEMP_DIR/no_toc.md'" \
    "No TOC markers" \
    false

# Create empty file
touch "$TEMP_DIR/empty.md"
test_case "empty file handling" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh '$TEMP_DIR/empty.md'" \
    "Empty file" \
    false

# Section 5: Error Conditions
echo -e "\n${BLUE}Testing Error Conditions${NC}"
test_case "nonexistent file" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh nonexistent.md" \
    "No such file" \
    false

test_case "directory as input" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh '$TEMP_DIR'" \
    "Is a directory" \
    false

# Create unreadable file
touch "$TEMP_DIR/unreadable.md"
chmod 000 "$TEMP_DIR/unreadable.md"
test_case "unreadable file" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh '$TEMP_DIR/unreadable.md'" \
    "Permission denied" \
    false
chmod 644 "$TEMP_DIR/unreadable.md"

# Create file with invalid markdown
cat > "$TEMP_DIR/invalid.md" << EOF
# [Invalid Markdown)
* Broken list
EOF

test_case "invalid markdown handling" \
    "$PROJECT_ROOT/scripts/update_md_tocs.sh '$TEMP_DIR/invalid.md'" \
    "Invalid markdown" \
    false

# Report results
echo
echo "Test Results:"
echo "Passed: $PASS"
echo "Failed: $FAIL"
exit $FAIL
