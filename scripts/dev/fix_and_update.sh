#!/bin/bash

#==============================================================================
# fix_and_update.sh
#==============================================================================
#
# DESCRIPTION:
#   Runs lint fixes and updates to code based on changes in the repository.
#   Intended to help maintain code quality and formatting consistency.
#
# USAGE:
#   fix_and_update.sh
#
# OPTIONS:
#   -v, --verbose    Enable verbose output
#   -h, --help      Show this help message
#==============================================================================

REPO_DIR="$(git rev-parse --show-toplevel)"

source "${REPO_DIR}/scripts/lib.sh"
parse_common_args "$@" >/dev/null # prevent return from echo'ng

print_status "Running trunk format and code check..."
if ! command_exists trunk; then
	print_status "Installing trunk..."
	# trunk-ignore(semgrep/bash.curl.security.curl-pipe-bash.curl-pipe-bash)
	curl https://get.trunk.io -fsSL | bash
fi
trunk check --all --ci
trunk fmt --all --ci

print_status "Checking for table of content updates in markdown files..."
"${REPO_DIR}"/scripts/dev/update_md_tocs.sh

log_success "All fixes applied and checks complete."
