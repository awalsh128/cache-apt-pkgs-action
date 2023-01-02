#!/bin/bash

# Fail on any error.
set -e

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Debug mode for diagnosing issues.
# Setup first before other operations.
debug="${1}"
validate_bool "${debug}" debug 1
test ${debug} == "true" && set -x

# Directory that holds the cached packages.
cache_dir="${2}"

# Version of the cache to create or load.
version="${3}"

# Additional repositories to include.
add_repositories="${4}"

# Trim commas, excess spaces, and sort.
repositories="$(normalize_list "${add_repositories}")"

# Execute post-installation script.
execute_install_scripts="${5}"

# List of the packages to use.
packages="${@:6}"

# Trim commas, excess spaces, and sort.
normalized_packages="$(normalize_list "${packages}")"

# Create cache directory so artifacts can be saved.
mkdir -p ${cache_dir}

log "Validating action arguments (version='${version}', packages='${normalized_packages}')...";
if grep -q " " <<< "${version}"; then
  log "aborted" 
  log "Version value '${version}' cannot contain spaces." >&2
  exit 2
fi

# Is length of string zero?
if test -z "${normalized_packages}"; then
  log "aborted"
  log "Packages argument cannot be empty." >&2
  exit 3
fi

validate_bool "${execute_install_scripts}" execute_install_scripts 4

log "done"

log_empty_line

versioned_packages=""
log "Verifying packages..."
for package in ${normalized_packages}; do 
  if test ! "$(apt-cache show "${package}")"; then
    echo "aborted"
    log "Package '${package}' not found." >&2
    exit 5
  fi
  read package_name package_ver < <(get_package_name_ver "${package}")
  versioned_packages=""${versioned_packages}" "${package_name}"="${package_ver}""
done
log "done"

log_empty_line

# Abort on any failure at this point.
set -e

log "Creating cache key..."

# TODO Can we prove this will happen again?
normalized_versioned_packages="$(normalize_list "${versioned_packages}")"
log "- Normalized package list is '${normalized_versioned_packages}'."

# Create value to hash for cache key.
value_to_hash="${normalized_versioned_packages}"
if test -n "${repositories}"; then
  log "- Added repository list is '${repositories}'."
  value_to_hash="${value_to_hash} add-repositories:'${repositories}'"
fi
value_to_hash="${value_to_hash}@ ${version}"

# Hash the value and set the key.
log "- Value to hash is '${value_to_hash}'."
hash_key="$(echo "${value_to_hash}" | md5sum | cut -f1 -d' ')"
log "- Value hashed as '${hash_key}'."

# Write the key out to match for future runs.
hash_key_filepath="${cache_dir}/cache_key.md5"
echo ${hash_key} > ${hash_key_filepath}
log "Hash value written to ${hash_key_filepath}"
