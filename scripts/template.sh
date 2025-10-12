#!/bin/bash

#==============================================================================
# template.sh
#==============================================================================
#
# DESCRIPTION:
#   Template script providing standard structure for all project Bash scripts.
#   Includes proper header format, function declarations, argument parsing,
#   and main execution flow.
#
# USAGE:
#   template.sh [OPTIONS]
#
# OPTIONS:
#   -v, --verbose    Enable verbose output
#   -h, --help       Show this help message
#   -yv, --your_var  Description of your_var
#
# DEPENDENCIES:
#   - lib.sh or dev/lib.sh for common functions
#
# EXAMPLES:
#   template.sh --verbose
#   template.sh --your_var value
#==============================================================================

set -eEuo pipefail

# For broad library functions
source "$(git rev-parse --show-toplevel)/scripts/lib.sh"
# ... or for development specific functions
# source "$(git rev-parse --show-toplevel)/scripts/dev/lib.sh"

##
# Process command line arguments and perform main script functionality.
# Arguments:
#   Command line arguments ($@)
# Returns:
#   0 on success, non-zero on failure
function main() {
  # Parse common args (verbose, help) first
  parse_common_args "$@"
  shift $((OPTIND - 1))

  # Process remaining arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
    -yv | --your_var)
      if [[ -z ${2-} ]]; then
        log_error "Missing value for $1"
        return 1
      fi
      local your_var="$2"
      shift 2
      ;;
    *)
      log_error "Unknown option: $1"
      log_info "Use --help for usage information."
      return 1
      ;;
    esac
  done

  # your code here
}

main "$@"
