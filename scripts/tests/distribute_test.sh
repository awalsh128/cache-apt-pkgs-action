#!/bin/bash

#==============================================================================
# distribute_test.sh
#==============================================================================
#
# DESCRIPTION:
#   Test suite for distribute.sh. Validates command handling, binary creation,
#   architecture-specific output, and error conditions for the distribution
#   script.
#
# USAGE:
#   distribute_test.sh [OPTIONS]
#
# OPTIONS:
#   -v, --verbose        Enable verbose test output
#   --stop-on-failure    Stop on first test failure
#   -h, --help           Show this help message
#
#==============================================================================

# Source the test framework, exports SCRIPT_PATH
source "$(git rev-parse --show-toplevel)/scripts/tests/test_lib.sh"

DIST_DIR="$(get_project_root)/dist"

# Define test functions
run_tests() {
  # Disable exit-on-error during test execution to prevent early exit
  set +e

  test_section "command validation"

  test_case "no command" \
    "" \
    "command not provided" \
    false

  test_case "invalid command" \
    "invalid_cmd" \
    "invalid command" \
    false

  test_section "getbinpath"

  test_case "getbinpath no arch" \
    "getbinpath" \
    "runner architecture not provided" \
    false

  test_case "getbinpath invalid arch" \
    "getbinpath INVALID" \
    "invalid runner architecture" \
    false

  test_section "push and binary creation"

  test_case "push command" \
    "push" \
    "All builds completed!" \
    true # Ensure test doesn't cause script exit

  # Test binary existence using direct shell commands instead of test_case
  # because the distribute script doesn't have a 'test' command
  for arch in "X86:386" "X64:amd64" "ARM:arm" "ARM64:arm64"; do
    go_arch=${arch#*:}
    test_file_exists "file exists for ${go_arch}" "${DIST_DIR}/cache-apt-pkgs-linux-${go_arch}"
  done

  # Test getbinpath for each architecture
  for arch in "X86:386" "X64:amd64" "ARM:arm" "ARM64:arm64"; do
    runner_arch=${arch%:*}
    go_arch=${arch#*:}
    test_case "getbinpath for ${runner_arch}" \
      "getbinpath ${runner_arch}" \
      "${DIST_DIR}/cache-apt-pkgs-linux-${go_arch}" \
      true
  done

  test_section "cleanup and rebuild"

  # Direct cleanup
  rm -rf "${DIST_DIR}" 2>/dev/null

  test_case "getbinpath after cleanup" \
    "getbinpath X64" \
    "binary not found" \
    false

  test_case "rebuild after cleanup" \
    "push" \
    "All builds completed!" \
    true

  test_case "getbinpath after rebuild" \
    "getbinpath X64" \
    "${DIST_DIR}/cache-apt-pkgs-linux-amd64" \
    true

  # Re-enable exit-on-error
  set -e
}

# Start the test framework and run tests
start_tests "$@"
run_tests
