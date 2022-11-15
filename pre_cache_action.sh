#!/bin/bash

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir="${1}"

# Version of the cache to create or load.
version="${2}"

# List of the packages to use.
input_packages="${@:3}"

# Trim commas, excess spaces, and sort.
packages="$(normalize_package_list "${input_packages}")"

# Create cache directory so artifacts can be saved.
mkdir -p ${cache_dir}

log "Validating action arguments (version='${version}', packages='${packages}')...";
if grep -q " " <<< "${version}"; then
  log "aborted" 
  log "Version value '${version}' cannot contain spaces." >&2
  exit 1
fi

# Is length of string zero?
if test -z "${packages}"; then
  log "aborted"
  log "Packages argument cannot be empty." >&2
  exit 2
fi

log "done"

log_empty_line

versioned_packages=""
log "Verifying packages..."
for package in ${packages}; do 
  if test ! "$(apt-cache show "${package}")"; then
    echo "aborted"
    log "Package '${package}' not found." >&2
    exit 3
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
normalized_versioned_packages="$(normalize_package_list "${versioned_packages}")"
log "- Normalized package list is '${normalized_versioned_packages}'."

value="${normalized_versioned_packages} @ ${version}"
log "- Value to hash is '${value}'."

key="$(echo "${value}" | md5sum | cut -f1 -d' ')"
log "- Value hashed as '${key}'."

log "done"

key_filepath="${cache_dir}/cache_key.md5"
echo ${key} > ${key_filepath}
log "Hash value written to ${key_filepath}"
