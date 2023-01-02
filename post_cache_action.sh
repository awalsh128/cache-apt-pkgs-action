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

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
# WARNING: If non-root, this can cause errors during install script execution.
cache_restore_root="${3}"

# Indicates that the cache was found.
cache_hit="${4}"

# Additional repositories to use for installation.
add_repositories="${5}"

# Cache and execute post install scripts on restore.
execute_install_scripts="${6}"

# List of the packages to use.
packages="${@:7}"

if [ "$cache_hit" == true ]; then
  ${script_dir}/restore_pkgs.sh "${debug}" "${cache_dir}" "${cache_restore_root}" "${execute_install_scripts}"
else
  ${script_dir}/install_and_cache_pkgs.sh "${debug}" "${cache_dir}" "${add_repositories}" ${packages}
fi

log_empty_line
