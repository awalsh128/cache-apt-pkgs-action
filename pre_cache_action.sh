#!/bin/bash

set -e

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Debug mode for diagnosing issues.
# Setup first before other operations.
debug="${4}"
validate_bool "${debug}" debug 1
test ${debug} == "true" && set -x

# Directory that holds the cached packages.
cache_dir="${1}"

# Version of the cache to create or load.
version="${2}"

# Execute post-installation script.
execute_install_scripts="${3}"

# Debug mode for diagnosing issues.
debug="${4}"

# List of the packages to use.
input_packages="${@:5}"

# Trim commas, excess spaces, and sort.
log "Normalizing package list..."
packages="$(get_normalized_package_list "${input_packages}")"
log "done"

# Create cache directory so artifacts can be saved.
mkdir -p ${cache_dir}

log "Validating action arguments (version='${version}', packages='${packages}')...";
if grep -q " " <<< "${version}"; then
  log "aborted" 
  log "Version value '${version}' cannot contain spaces." >&2
  exit 2
fi

# Is length of string zero?
if test -z "${packages}"; then
  case "$EMPTY_PACKAGES_BEHAVIOR" in
    ignore)
      exit 0
      ;;
    warn)
      echo "::warning::Packages argument is empty."
      exit 0
      ;;
    *)
      log "aborted"
      log "Packages argument is empty." >&2
      exit 3
      ;;
  esac
fi

validate_bool "${execute_install_scripts}" execute_install_scripts 4

log "done"

log_empty_line

# Abort on any failure at this point.
set -e

log "Creating cache key..."

# Forces an update in cases where an accidental breaking change was introduced
# and a global cache reset is required, or change in cache action requiring reload.
force_update_inc="3"

# Force a different cache key for different architectures (currently x86_64 and aarch64 are available on GitHub)
cpu_arch="$(arch)"
log "- CPU architecture is '${cpu_arch}'."

value="${packages} @ ${version} ${force_update_inc}"

# Don't invalidate existing caches for the standard Ubuntu runners
if [ "${cpu_arch}" != "x86_64" ]; then
  value="${value} ${cpu_arch}"
  log "- Architecture '${cpu_arch}' added to value."
fi

log "- Value to hash is '${value}'."

key="$(echo "${value}" | md5sum | cut -f1 -d' ')"
log "- Value hashed as '${key}'."

log "done"

key_filepath="${cache_dir}/cache_key.md5"
echo ${key} > ${key_filepath}
log "Hash value written to ${key_filepath}"
