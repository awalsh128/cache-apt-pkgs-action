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

# Repositories to add before installing packages.
add_repository="${5}"

# GPG-signed third-party repository sources.
apt_sources="${6}"

# List of the packages to use.
input_packages="${@:7}"

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

# Basic validation for repository parameter
if [ -n "${add_repository}" ]; then
  log "Validating repository parameter..."
  for repository in ${add_repository}; do
    # Check if repository format looks valid (basic check)
    if [[ "${repository}" =~ [^a-zA-Z0-9:\/.-] ]]; then
      log "aborted"
      log "Repository '${repository}' contains invalid characters." >&2
      log "Supported formats: 'ppa:user/repo', 'deb http://...', 'http://...', 'multiverse', etc." >&2
      exit 6
    fi
  done
  log "done"
fi

# Validate apt-sources parameter
if [ -n "${apt_sources}" ]; then
  log "Validating apt-sources parameter..."
  while IFS= read -r line; do
    # Skip empty lines.
    if [ -z "$(echo "${line}" | tr -d '[:space:]')" ]; then
      continue
    fi
    # Each line must contain a pipe separator.
    if ! echo "${line}" | grep -q '|'; then
      log "aborted"
      log "apt-sources line missing '|' separator: ${line}" >&2
      log "Expected format: key_url | source_spec" >&2
      exit 7
    fi
    # Key URL must start with https://
    key_url_check=$(echo "${line}" | cut -d'|' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if ! echo "${key_url_check}" | grep -qE '^https://'; then
      log "aborted"
      log "apt-sources key URL must start with https:// but got: ${key_url_check}" >&2
      exit 7
    fi
  done <<< "${apt_sources}"
  log "done"
fi

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

# Include repositories in cache key to ensure different repos get different caches
if [ -n "${add_repository}" ]; then
  value="${value} ${add_repository}"
  log "- Repositories '${add_repository}' added to value."
fi

# Include apt-sources in cache key (normalize to single line for stable hashing)
if [ -n "${apt_sources}" ]; then
  normalized_sources=$(echo "${apt_sources}" | sed '/^[[:space:]]*$/d' | sort | tr '\n' '|')
  value="${value} apt-sources:${normalized_sources}"
  log "- Apt sources added to value."
fi

# Don't invalidate existing caches for the standard Ubuntu runners
if [ "${cpu_arch}" != "x86_64" ]; then
  value="${value} ${cpu_arch}"
  log "- Architecture '${cpu_arch}' added to value."
fi

# Include a hash of pre-installed packages so runners with different base
# images (e.g., GPU runners with CUDA pre-installed vs plain Ubuntu) get
# different cache keys. This prevents a cache built on runner A (where some
# packages were already installed) from being restored on runner B (where
# those packages are missing).
base_pkgs_hash="$(dpkg-query -W -f='${binary:Package}\n' | sha1sum | cut -f1 -d' ')"
value="${value} base:${base_pkgs_hash}"
log "- Base packages hash '${base_pkgs_hash}' added to value."
echo "::notice::Runner base image fingerprint: ${base_pkgs_hash}. Runners with different pre-installed packages produce different fingerprints and cannot share caches."

log "- Value to hash is '${value}'."

key="$(echo "${value}" | md5sum | cut -f1 -d' ')"
log "- Value hashed as '${key}'."

log "done"

key_filepath="${cache_dir}/cache_key.md5"
echo ${key} > ${key_filepath}
log "Hash value written to ${key_filepath}"
