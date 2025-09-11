#!/bin/bash

#==============================================================================
# fix_and_update.sh
#==============================================================================
#
# DESCRIPTION:
#   Runs lint fixes and checks for UTF-8 formatting issues in the project.
#   Intended to help maintain code quality and formatting consistency.
#
# USAGE:
#   fix_and_update.sh
#
# OPTIONS:
#   -v, --verbose    Enable verbose output
#   -h, --help      Show this help message
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"
parse_common_args "$@" >/dev/null # prevent return from echo'ng

print_status "Running trunk format and code check..."
require_command trunk "Install trunk to run lint fixes via curl https://get.trunk.io -fsSL | bash."
trunk check --all --ci
trunk fmt --all --ci

log_success "All lint fixes applied and checks complete."
