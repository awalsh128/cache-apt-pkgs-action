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
#   export_version_test.sh [OPTIONS]
#
# OPTIONS:
#   -v, --verbose        Enable verbose test output
#   --stop-on-failure    Stop on first test failure
#   -h, --help           Show this help message
#
#==============================================================================

# Source the test framework, exports SCRIPT_PATH
source "$(git rev-parse --show-toplevel)/scripts/tests/test_lib.sh"

# Define test functions
run_tests() {
  test_section "Command Line Interface"

  test_case "basic execution" \
    "" \
    "Exporting version information" \
    true

  test_section "File Generation"

  test_case "version info file creation" \
    "" \
    "Version information has been exported" \
    true

  test_case "JSON file creation" \
    "" \
    "exported in JSON format" \
    true

  test_section "File Contents Validation"

  local project_root
  project_root=$(get_project_root)
  # Test that files exist and contain expected content
  test_file_exists "version info file exists" "${project_root}/.version-info"
  test_file_exists "JSON version file exists" "${project_root}/.version-info.json"

  test_file_contains "version file contains Go version" \
    "${project_root}/.version-info" \
    "GO_VERSION="

  test_file_contains "JSON file contains Go version" \
    "${project_root}/.version-info.json" \
    '"goVersion":'
}

# Start the test framework and run tests
start_tests "$@"
run_tests
