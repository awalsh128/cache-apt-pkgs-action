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
test -d ${cache_restore_root} || mkdir ${cache_restore_root}

# Cache and execute post install scripts on restore.
execute_install_scripts="${4}"

cache_filepaths="$(ls -1 "${cache_dir}" | sort)"
log "Found $(echo ${cache_filepaths} | wc -w) files in the cache."
for cache_filepath in ${cache_filepaths}; do
  log "- "$(basename ${cache_filepath})""
done

log_empty_line

log "Reading from main requested packages manifest..."
for logline in $(cat "${cache_dir}/manifest_main.log" | tr ',' '\n' ); do
  log "- $(echo "${logline}" | tr ':' ' ')"
done
log "done"

log_empty_line

# Only search for archived results. Manifest and cache key also live here.
cached_pkg_filepaths=$(ls -1 "${cache_dir}"/*.tar | sort)
cached_pkg_filecount=$(echo ${cached_pkg_filepaths} | wc -w)

log "Restoring ${cached_pkg_filecount} packages from cache..."
for cached_pkg_filepath in ${cached_pkg_filepaths}; do

  log "- $(basename "${cached_pkg_filepath}") restoring..."
  sudo tar -xf "${cached_pkg_filepath}" -C "${cache_restore_root}" > /dev/null
  log "  done"

  # Execute install scripts if available.    
  if test ${execute_install_scripts} == "true"; then
    # May have to add more handling for extracting pre-install script before extracting all files.
    # Keeping it simple for now.
    execute_install_script "${cache_restore_root}" "${cached_pkg_filepath}" preinst install
    execute_install_script "${cache_restore_root}" "${cached_pkg_filepath}" postinst configure
  fi
done
log "done"
