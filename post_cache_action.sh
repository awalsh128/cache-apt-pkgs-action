#!/bin/bash

# Fail on any error.
set -e

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir="${1}"

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
# WARNING: If non-root, this can cause errors during install script execution.
cache_restore_root="${2}"

# Indicates that the cache was found.
cache_hit="${3}"

# Cache and execute post install scripts on restore.
execute_install_scripts="${4}"

# Debug mode for diagnosing issues.
debug="${5}"
test "${debug}" = "true" && set -x

# Repositories to add before installing packages.
add_repository="${6}"

# List of the packages to use.
# Try to read from saved file first (includes Aptfile packages), fallback to input
packages_filepath="${cache_dir}/packages.txt"
if test -f "${packages_filepath}"; then
  packages="$(cat "${packages_filepath}")"
  # Check if packages.txt is empty or contains only whitespace
  if test -z "${packages}"; then
    log "packages.txt exists but is empty, falling back to input packages"
    packages="${*:7}"
  else
    log "Using packages from cache directory (includes Aptfile if present)"
  fi
else
  # Fallback to input packages (for backwards compatibility)
  packages="${*:7}"
  log "Using packages from input (Aptfile not processed)"
fi

if test "${cache_hit}" = "true"; then
  "${script_dir}/restore_pkgs.sh" "${cache_dir}" "${cache_restore_root}" "${execute_install_scripts}" "${debug}"
else
  # shellcheck disable=SC2086
  # INTENTIONAL: packages must be unquoted to expand into separate arguments for install_and_cache_pkgs.sh
  "${script_dir}/install_and_cache_pkgs.sh" "${cache_dir}" "${debug}" "${add_repository}" ${packages}
fi

log_empty_line
