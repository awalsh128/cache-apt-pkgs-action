#!/bin/bash
# Shared helpers for the release scripts in this directory.
# Source this file; do not execute it directly.

#######################################
# Yes or no prompt. Auto-confirms when CI=true or ASSUME_YES=1 so the
# scripts can also run from a GitHub workflow.
# Arguments:
#   Message to display at prompt.
# Returns:
#   0 on yes, exits the script on no.
#######################################
function confirm_prompt {
  if [[ "${CI:-}" == "true" || "${ASSUME_YES:-}" == "1" ]]; then
    echo "${1} [auto-confirmed]"
    return 0
  fi
  while true; do
    read -r -p "${1} [Y|n] " response
    case ${response} in
      [Yy]*) return 0 ;;
      [Nn]*) exit 0 ;;
      *) echo "Invalid option selected." ;;
    esac
  done
}

#######################################
# Validate argument and exit if invalid.
# Arguments:
#   Argument to validate.
#   Message to display on error.
#   Usage message.
# Returns:
#   None, exits non-zero when the argument is empty.
#######################################
function validate_arg {
  if [[ -z "${1:-}" ]]; then
    printf 'error: %s\n%s\n' "${2}" "${3}" >&2
    exit 1
  fi
}

#######################################
# Print out command usage.
# Arguments:
#   Name of command.
#   Parameters.
# Returns:
#   Usage message.
#######################################
function usage {
  echo "usage: $(basename "${1}") ${2}"
}
