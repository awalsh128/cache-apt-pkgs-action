#!/bin/bash

#==============================================================================
# setup.sh
#==============================================================================
#
# DESCRIPTION:
#   Validates binary existence, checksum, and action pinning for
#   cache-apt-pkgs-action in CI/CD workflows. Provides functions for checksum
#   reading, SHA256 calculation, and pinning validation.
#
# USAGE:
#   setup.sh [OPTIONS]
#
# OPTIONS:
#   -h,   --help      Show this help message
#   -v,   --verbose   Enable verbose output
#==============================================================================

set -euo pipefail

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"

##
# Reads and trims a checksum file, errors if empty.
# Arguments:
#   $1 - Path to checksum file
# Returns:
#   Trimmed checksum string, or exits with error if file is missing/empty.
function read_checksum() {
	local path="$1"
	if [[ ! -f ${path} ]]; then
		log_error "Checksum file ${path} does not exist"
		return 1
	fi
	local trimmed
	trimmed="$(tr <"${path}" -d '\n' | xargs)"
	if [[ -z ${trimmed} ]]; then
		log_error "Checksum file ${path} is empty"
		return 1
	fi
	echo "${trimmed}"
}

##
# Computes SHA256 checksum of a file.
# Arguments:
#   $1 - Path to file
# Returns:
#   SHA256 checksum string, or exits with error if file is missing.
function compute_checksum() {
	local path="$1"
	if [[ ! -f ${path} ]]; then
		log_error "File ${path} does not exist"
		return 1
	fi
	sha256sum "${path}" | awk '{print $1}'
}

##
# Checks if a string is a 40-character hex SHA.
# Arguments:
#   $1 - String to check
# Returns:
#   0 if valid hex SHA, 1 otherwise.
function is_hex_sha() {
	local value="$1"
	[[ ${#value} -eq 40 ]] && [[ ${value} =~ ^[0-9a-fA-F]{40}$ ]]
}

##
# Ensures the action is pinned to a tag or commit.
# Checks GITHUB_ACTION_REF and GITHUB_ACTION_REF_TYPE to ensure the action
# is not referencing a branch. Logs info or error and returns appropriate code.
function ensure_action_is_pinned() {
	local ref="${GITHUB_ACTION_REF-}"           # e.g. refs/tags/v1.2.3 or commit SHA
	local ref_type="${GITHUB_ACTION_REF_TYPE-}" # branch, tag, commit
	case "${ref_type,,}" in
	branch)
		log_error "GitHub workflow must pin awalsh128/cache-apt-pkgs-action to a specific tag or commit; current reference '${ref}' resolves to a branch"
		return 1
		;;
	tag)
		log_info "Action is pinned to release tag ${ref}"
		return 0
		;;
	commit)
		log_info "Action is pinned to commit ${ref}"
		return 0
		;;
	*)
		# Unknown ref type — fall through to additional detection below.
		# Intentionally do not return here so later checks can inspect GITHUB_ACTION_REF
		# and determine if the reference is a tag, commit SHA, or a branch.
		;;
	esac
	if [[ -z ${ref} ]]; then
		log_info "Action is pinned to a commit SHA (GITHUB_ACTION_REF not provided)"
		return 0
	fi
	if is_hex_sha "${ref}"; then
		log_info "Action is pinned to commit ${ref}"
		return 0
	fi
	if [[ ${ref} == refs/tags/* ]]; then
		log_info "Action is pinned to release tag ${ref#refs/tags/}"
		return 0
	fi
	if [[ ${ref,,} == refs/heads/* ]]; then
		log_error "GitHub workflow must pin awalsh128/cache-apt-pkgs-action to a specific tag or commit; current reference '${ref}' resolves to a branch"
		return 1
	fi
	log_error "GitHub workflow must pin awalsh128/cache-apt-pkgs-action to a specific tag or commit; unable to determine reference type for '${ref}'"
	return 1
}

# Main script logic: expects 2 arguments
#   $1 - binary path
#   $2 - checksum file path
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
	if [[ $# -ne 2 ]]; then
		echo "Usage: $0 <binary_path> <checksum_file>" >&2
		exit 1
	fi
	binary_path="$1"
	checksum_file="$2"

	# Validate binary existence
	if [[ ! -f ${binary_path} ]]; then
		log_error "Binary not found: ${binary_path}"
		exit 1
	fi

	# Validate checksum file existence and contents
	expected_checksum="$(read_checksum "${checksum_file}")"
	actual_checksum="$(compute_checksum "${binary_path}")"
	if [[ ${expected_checksum} != "${actual_checksum}" ]]; then
		log_error "Checksum mismatch for ${binary_path}"
		log_error "Expected: ${expected_checksum}"
		log_error "Actual:   ${actual_checksum}"
		exit 1
	fi

	# Ensure action is pinned
	ensure_action_is_pinned
fi
