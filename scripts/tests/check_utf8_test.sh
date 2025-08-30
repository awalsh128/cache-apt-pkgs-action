#!/bin/bash

#==============================================================================
# check_utf8_test.sh
#==============================================================================
# 
# DESCRIPTION:
#   Test suite for check_utf8.sh script.
#   Validates UTF-8 encoding detection, file handling, and error conditions.
#
# USAGE:
#   ./scripts/tests/check_utf8_test.sh [-v|--verbose] [-r|--recursive]
#
# OPTIONS:
#   -v, --verbose    Show verbose test output
#   -r, --recursive  Test recursive directory scanning
#   -h, --help       Show this help message
#
#==============================================================================

# Source the test library
source "$(dirname "$0")/test_lib.sh"

# Additional settings
TEST_RECURSIVE=false

# Dependencies check
check_dependencies "file" "iconv" || exit 1

# Parse arguments (handle any unprocessed args from common parser)
while [[ -n "$1" ]]; do
    arg="$(parse_common_args "$1")"
    case "$arg" in
        -r|--recursive)
            TEST_RECURSIVE=true
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

# Create test files with different encodings
create_encoded_file() {
    local file="$1"
    local content="$2"
    local encoding="$3"
    
    if [[ "$encoding" == "utf8" ]]; then
        create_test_file "$file" "$content"
    else
        echo -n "$content" | iconv -f UTF-8 -t "$encoding" > "$file"
        print_info "Created $encoding encoded file: $file"
    fi
}

print_header "Check UTF-8 Tests"

# Section 1: Command Line Interface
print_section "Testing Command Line Interface"
test_case "help option" 
    "$PROJECT_ROOT/scripts/check_utf8.sh --help" 
    "Usage:" 
    true

test_case "unknown option" 
    "$PROJECT_ROOT/scripts/check_utf8.sh --unknown" 
    "Unknown option" 
    false

# Section 2: Basic File Encoding Detection
print_section "Testing Basic File Encoding Detection"
create_encoded_file "$TEMP_DIR/utf8.txt" "Hello, 世界!" "utf8"
create_encoded_file "$TEMP_DIR/latin1.txt" "Hello, World!" "ISO-8859-1"

test_case "single utf8 file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh $TEMP_DIR/utf8.txt" \
    "" \
    true \
    "UTF-8 file should pass validation"

test_case "single latin1 file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh $TEMP_DIR/latin1.txt" \
    "non-UTF-8" \
    false \
    "Latin-1 file should fail validation"

# Section 3: Multiple File Handling
print_section "Testing Multiple File Handling"

create_encoded_file "$TEMP_DIR/mixed1.txt" "Hello" "utf8"
create_encoded_file "$TEMP_DIR/mixed2.txt" "World" "ISO-8859-1"

test_case "multiple mixed files" \
    "$PROJECT_ROOT/scripts/check_utf8.sh $TEMP_DIR/mixed1.txt $TEMP_DIR/mixed2.txt" \
    "non-UTF-8" \
    false \
    "Multiple files with mixed encodings should fail"

# Section 4: Special Cases
print_section "Testing Special Cases"

create_test_file "$TEMP_DIR/empty.txt" ""
test_case "empty file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh '$TEMP_DIR/empty.txt'" \
    "" \
    true \
    "Empty file should be considered valid UTF-8"

test_case "missing file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh '$TEMP_DIR/nonexistent.txt'" \
    "No such file" \
    false \
    "Missing file should fail with appropriate error"

test_case "invalid directory" \
    "$PROJECT_ROOT/scripts/check_utf8.sh '$TEMP_DIR/nonexistent'" \
    "No such file" \
    false \
    "Invalid directory should fail with appropriate error"

# Print test summary
print_summary

# Optional recursive testing section
if [[ "$TEST_RECURSIVE" == "true" ]]; then
    print_section "Testing Recursive Directory Handling"
    create_test_dir "$TEMP_DIR/subdir/deep"
    create_encoded_file "$TEMP_DIR/subdir/deep/utf8_deep.txt" "Deep UTF-8" "utf8"
    create_encoded_file "$TEMP_DIR/subdir/deep/latin1_deep.txt" "Deep Latin-1" "ISO-8859-1"
    
    test_case "recursive directory check" \
        "$PROJECT_ROOT/scripts/check_utf8.sh -r '$TEMP_DIR'" \
        "non-UTF-8" \
        false \
        "Recursive check should find non-UTF-8 files in subdirectories"
fi \
    "" \
    true

# Create file with BOM
printf '\xEF\xBB\xBF' > "$TEMP_DIR/with_bom.txt"
echo "Hello, World!" >> "$TEMP_DIR/with_bom.txt"
test_case "UTF-8 with BOM" \
    "$PROJECT_ROOT/scripts/check_utf8.sh '$TEMP_DIR/with_bom.txt'" \
    "" \
    true

# Section 5: Error Conditions
echo -e "\n${BLUE}Testing Error Conditions${NC}"
test_case "nonexistent file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh nonexistent.txt" \
    "No such file" \
    false

test_case "directory as file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh '$TEMP_DIR'" \
    "Is a directory" \
    false

# Create unreadable file
touch "$TEMP_DIR/unreadable.txt"
chmod 000 "$TEMP_DIR/unreadable.txt"
test_case "unreadable file" \
    "$PROJECT_ROOT/scripts/check_utf8.sh '$TEMP_DIR/unreadable.txt'" \
    "Permission denied" \
    false
chmod 644 "$TEMP_DIR/unreadable.txt"

# Report results
echo
echo "Test Results:"
echo "Passed: $PASS"
echo "Failed: $FAIL"
exit $FAIL
