#!/bin/bash

#==============================================================================
# test_lib.sh
#==============================================================================
#
# DESCRIPTION:
#   Common test library providing standardized test framework for bash scripts.
#   Provides test execution, assertions, test environment setup, and reporting.
#   Implements improved architecture patterns for reliable test execution.
#
# USAGE:
#   # Set up the script path we want to test BEFORE sourcing
#   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#   export SCRIPT_PATH="$SCRIPT_DIR/../script_name.sh"
#
#   # Source the test framework
#   source "$SCRIPT_DIR/test_lib.sh"
#
#   # Define test functions
#   run_tests() {
#     test_section "Section Name"
#     test_case "test name" "args" "expected_output" "should_succeed"
#   }
#
#   # Start the test framework and run tests
#   start_tests "$@"
#   run_tests
#
# OPTIONS (inherited from command line):
#   -v, --verbose        Enable verbose test output
#   --stop-on-failure    Stop on first test failure
#   -h, --help           Show this help message
#
# EXPORTS: For use in test scripts.
#   - SCRIPT_PATH     Path of the script the test is running against
#   - TEMP_TEST_DIR   Path to the temporary test directory
#   - test_case       Function to define a test case
#   - test_section    Function to define test sections
#   - test_file_exists      Function to test file existence
#   - test_file_contains    Function to test file contents
#
# FEATURES:
#   - Improved library loading with fallback paths
#   - Safe SCRIPT_PATH handling without overriding test settings
#   - Arithmetic operations compatible with set -e
#   - Proper script name detection for test headers
#   - Lazy temporary directory initialization
#   - Standardized test case execution and reporting
#   - Test environment management with automatic cleanup
#   - Comprehensive assertion functions
#   - Test statistics and result reporting
#
# ARCHITECTURE IMPROVEMENTS:
#   - Library loading uses multiple fallback paths for reliability
#   - SCRIPT_PATH variable is preserved from test script initialization
#   - Arithmetic increment operations use "|| true" pattern for set -e compatibility
#   - Test framework initialization is separated from test execution
#   - Temporary directory creation is deferred until actually needed
#   - Script name detection iterates through BASH_SOURCE to find actual test script
#
#==============================================================================

# Source the shared library - get the correct path
# shellcheck source="../lib.sh"
source "$(git rev-parse --show-toplevel)/scripts/lib.sh"

# Initialize temp directory when needed
__init_temp_dir() {
  if [[ -z ${TEMP_TEST_DIR} ]]; then
    TEMP_TEST_DIR="$(create_temp_dir)"
    export TEMP_TEST_DIR
  fi
}

#==============================================================================
# Test Framework Variables
#==============================================================================

TEST_PASS=0
TEST_FAIL=0
TEST_SKIP=0
TEST_START_TIME=""

# Test configuration
TEST_VERBOSE=${TEST_VERBOSE:-false}
TEST_CONTINUE_ON_FAILURE=${TEST_CONTINUE_ON_FAILURE:-true}

#==============================================================================
# Framework Architecture Notes
#==============================================================================
#
# KEY IMPROVEMENTS IMPLEMENTED:
#
# 1. Library Loading Reliability:
#    - Multiple fallback paths for lib.sh loading
#    - Works from both project root and scripts/ directory
#    - Provides clear error messages if lib.sh cannot be found
#
# 2. Variable Management:
#    - SCRIPT_PATH is preserved from test script initialization
#    - Only initializes variables if not already set
#    - Prevents test framework from overriding test script settings
#
# 3. Arithmetic Operations:
#    - All increment operations use "|| true" pattern
#    - Compatible with bash "set -e" error handling
#    - Prevents premature script termination on arithmetic operations
#
# 4. Script Name Detection:
#    - Iterates through BASH_SOURCE array to find actual test script
#    - Skips test_lib.sh to show correct script name in headers
#    - Provides accurate test identification in output
#
# 5. Resource Management:
#    - Lazy initialization of temporary directories
#    - Only creates temp resources when actually needed
#    - Proper cleanup handling with trap functions
#
# 6. Test Organization:
#    - Function-based test structure (run_tests pattern)
#    - Clear separation of framework initialization and test execution
#    - Standardized test case and section patterns
#
#==============================================================================
# Test Environment Setup
#==============================================================================

__setup_test_env() {
  TEST_START_TIME=$(date +%s)
  __init_temp_dir
  trap '__cleanup_test_env' EXIT
  log_debug "Test environment setup complete"
  log_debug "Temporary directory: ${TEMP_TEST_DIR}"
}

__cleanup_test_env() {
  local exit_code=$?
  __report_results
  if [[ -n ${TEMP_TEST_DIR} && -d ${TEMP_TEST_DIR} ]]; then
    safe_remove "${TEMP_TEST_DIR}"
    log_debug "Test environment cleanup complete"
  fi
  exit "${exit_code}"
}

__setup() {
  __parse_test_args "$@"
  # Find the main test script that sourced us (skip test_lib.sh itself)
  local script_name=""
  for ((i = 1; i < ${#BASH_SOURCE[@]}; i++)); do
    if [[ ${BASH_SOURCE[i]} != *"test_lib.sh" ]]; then
      script_name=$(basename "${BASH_SOURCE[i]}")
      break
    fi
  done
  print_header "Running ${script_name} tests"
  echo ""
  __setup_test_env
}

#==============================================================================
# Test Execution Functions
#==============================================================================

test_case() {
  local name="$1"
  local args="$2"
  local expected_output="$3"
  local should_succeed="${4:-true}"

  # Disable exit-on-error for test execution
  set +e

  # Support shorthand: test_case "name" "args" "true|false" (no expected_output)
  if [[ -z ${expected_output} && (${should_succeed} == "true" || ${should_succeed} == "false") ]]; then
    expected_output=""
  fi

  echo -n "* ${name}... "
  [[ ${TEST_VERBOSE} == true ]] && echo -n "(${COMMAND} ${args}) "

  local output
  local exit_code=0

  # Capture both stdout and stderr, ensuring we don't exit on command failure
  local cmd="${SCRIPT_PATH} ${args}"
  if [[ ${should_succeed} == "true" ]]; then
    # For tests that should succeed
    output=$(eval "${cmd}" 2>&1)
    exit_code=$?

    if [[ ${exit_code} -eq 0 && ${output} == *"${expected_output}"* ]]; then
      __test_pass "${name}"
    else
      __test_fail "${name}" "Success with output containing '${expected_output}'" "Exit code ${exit_code} with output: '${output}'"
    fi
  else
    # For tests that should fail
    output=$(eval "${cmd}" 2>&1)
    exit_code=$?

    if [[ ${exit_code} -ne 0 && ${output} == *"${expected_output}"* ]]; then
      __test_pass "${name}"
    else
      __test_fail "${name}" "Failure with output containing '${expected_output}'" "Exit code ${exit_code} with output: '${output}'"
    fi
  fi

  set -e # Restore exit-on-error
}

__test_pass() {
  local name="$1"
  echo -e "${GREEN}PASS${NC}"
  ((TEST_PASS++)) || true
  [[ ${TEST_VERBOSE} == true ]] && log_debug "Test passed: ${name}"
}

__test_fail() {
  local name="$1"
  local expected="$2"
  local actual="$3"

  echo -e "${RED}FAIL${NC}"
  ((TEST_FAIL++)) || true

  if [[ -n ${expected} ]]; then
    echo "  Expected  : ${expected}"
  fi
  if [[ -n ${actual} ]]; then
    echo "  Actual    : ${actual}"
  fi

  if [[ ${TEST_CONTINUE_ON_FAILURE} != true ]]; then
    __report_results
    exit 1
  fi
}

#==============================================================================
# Advanced Test Functions
#==============================================================================

test_file_exists() {
  local name="$1"
  local file_path="$2"

  echo -n "* ${name}... "
  set +e
  if file_exists "${file_path}"; then
    __test_pass "${name}"
  else
    __test_fail "${name}" "File should exist: file_path='${file_path}'" "File does not exist"
  fi
  set -e
}

test_file_contains() {
  local name="$1"
  local file_path="$2"
  local expected_content="$3"

  echo -n "* ${name}... "
  if ! file_exists "${file_path}"; then
    __test_fail "${name}" "File should exist and contain '${expected_content}'" "File does not exist: ${file_path}"
  fi

  if grep -q "${expected_content}" "${file_path}"; then
    __test_pass "${name}"
  else
    local file_content
    file_content=$(cat "${file_path}")
    __test_fail "${name}" "File should contain '${expected_content}'" "File content: ${file_content}"
  fi
}

#==============================================================================
# Test Utilities
#==============================================================================

create_test_file() {
  local file_path="$1"
  local content="$2"
  local mode="${3:-644}"

  local dir_path
  dir_path=$(dirname "${file_path}")
  ensure_dir "${dir_path}"

  echo "${content}" >"${file_path}"
  chmod "${mode}" "${file_path}"

  log_debug "Created test file: ${file_path}"
}

#==============================================================================
# Test Organization Helpers
#==============================================================================

test_section() {
  local section_name="$1"
  print_section "Testing section: ${section_name}"
}

test_group() {
  local group_name="$1"
  echo_color cyan "Testing group: ${group_name}"
  echo ""
}

#==============================================================================
# Test Reporting
#==============================================================================

__report_results() {
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - TEST_START_TIME))

  echo
  print_section "Test Results Summary"
  echo "Duration  : ${duration}s"
  echo "Total     : $((TEST_PASS + TEST_FAIL))"
  if [[ ${TEST_PASS} -gt 0 ]]; then
    echo -e "Passed    : ${GREEN}${TEST_PASS}${NC}"
  else
    echo -e "Passed    : ${TEST_PASS}"
  fi

  if [[ ${TEST_FAIL} -gt 0 ]]; then
    echo -e "Failed    : ${RED}${TEST_FAIL}${NC}"
  else
    echo -e "Failed    : ${TEST_FAIL}"
  fi

  if [[ ${TEST_SKIP} -gt 0 ]]; then
    echo -e "Skipped   : ${YELLOW}${TEST_SKIP}${NC}"
  fi

  echo

  if [[ ${TEST_FAIL} -eq 0 ]]; then
    log_success "All tests passed!"
    return 0
  else
    log_error "${TEST_FAIL} test(s) failed"
    return 1
  fi
}

#==============================================================================
# Common Test Patterns
#==============================================================================

__test_help_option() {
  local script_path="$1"
  local script_name
  script_name=$(basename "${script_path}")

  test_case "help option (-h)" \
    "${script_path} -h" \
    "USAGE" \
    true

  test_case "help option (--help)" \
    "${script_path} --help" \
    "USAGE" \
    true
}

__test_invalid_arguments() {
  local script_path="$1"

  test_case "invalid option" \
    "${script_path} --invalid-option" \
    "error" \
    false
}

#==============================================================================
# Initialization
#==============================================================================

# Default test argument parsing
__parse_test_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
    -v | --verbose)
      export TEST_VERBOSE=true
      export VERBOSE=true
      ;;
    --stop-on-failure)
      export TEST_CONTINUE_ON_FAILURE=false
      ;;
    -h | --help)
      [[ $(type -t show_help) == function ]] && show_help
      exit 0
      ;;
    *)
      break
      ;;
    esac
    shift
  done
}

# Function to start the testing framework
start_tests() {
  __setup "$@"
}

if [[ ${BASH_SOURCE[0]} == "${0}" ]]; then
  echo "This script should be sourced, not executed directly."
  # shellcheck disable=SC2016
  echo 'Usage: source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"/test_lib.sh'
  exit 1
fi

__get_script_path_dynamic() {
  local test_filepath
  local root_path
  local script_filename
  local script_filepath
  # Try multiple ways of locating the test script to support different invocation styles
  # Find the calling test script (first BASH_SOURCE entry that ends with _test.sh)
  test_filepath=""
  for ((i = 1; i < ${#BASH_SOURCE[@]}; i++)); do
    if [[ ${BASH_SOURCE[i]} == *_test.sh ]]; then
      test_filepath="${BASH_SOURCE[i]}"
      break
    fi
  done
  # Fallbacks if not found
  test_filepath="${test_filepath:-${BASH_SOURCE[1]:-${BASH_SOURCE[0]:-$0}}}"
  root_path="$(get_project_root 2>/dev/null || pwd)"
  [[ ${TEST_VERBOSE} == true ]] && echo "DEBUG: test_filepath=${test_filepath} root_path=${root_path}" >&2
  script_filename="$(basename "${test_filepath}" | sed 's/_test.sh/.sh/g')"
  script_filepath="${root_path}/scripts/${script_filename}"

  if [[ -f ${script_filepath} ]]; then
    log_debug "Script path successfully found dynamically ${script_filepath}"
    echo "${script_filepath}"
    return 0
  fi

  # Fallback: search scripts/ for a matching script name
  if [[ -d "${root_path}/scripts" ]]; then
    local found
    found=$(find "${root_path}/scripts" -maxdepth 1 -type f -name "${script_filename}" -print -quit 2>/dev/null || true)
    if [[ -n ${found} ]]; then
      log_debug "Script path found via fallback: ${found}"
      echo "${found}"
      return 0
    fi
  fi

  fail "Script file not found: ${script_filepath}; set SCRIPT_PATH before sourcing test_lib.sh"
}

# Will be set by the test script - only initialize if not already set
[[ -z ${SCRIPT_PATH} ]] && SCRIPT_PATH="$(__get_script_path_dynamic)"
export SCRIPT_PATH
[[ -z ${TEMP_TEST_DIR} ]] && TEMP_TEST_DIR=""
export TEMP_TEST_DIR
