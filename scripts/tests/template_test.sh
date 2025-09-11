#!/bin/bash

#==============================================================================
# <script name>.sh
#==============================================================================
#
# DESCRIPTION:
#   Test suite for <script name>.sh. Validates <brief description of what is
#   being tested>.
#
# USAGE:
#   <script name>.sh [OPTIONS]
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
  # Prints "Testing group <test group one name>"
  print_group "<test group one name>"

  # Prints "Testing section <test section 1 name>"
  print_section "<test section 1 name>"

  test_case "<test name 1>" \
    "" \
    "No changes made" \
    false

  test_case "<test name 2>" \
    "with_changes" \
    "" \
    false

  # Prints "Testing section <test section 2 name>"
  print_section "<test section 2 name>"

  test_case "<test name 3>" \
    "" \
    "No changes made" \
    false
}
