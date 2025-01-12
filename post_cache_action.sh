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

# List of the packages to use.
packages="${@:6}"

([ "${cache_hit}" = "true" ] && ${script_dir}/restore_pkgs.sh "${cache_dir}" "${cache_restore_root}" "${execute_install_scripts}" "${debug}") || ${script_dir}/install_and_cache_pkgs.sh "${cache_dir}" "${debug}" ${packages}

log_empty_line
