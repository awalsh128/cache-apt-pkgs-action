#!/bin/bash

# Fail on any error.
set -e

# Debug mode for diagnosing issues.
# Setup first before other operations.
debug="${4}"
test "${debug}" == "true" && set -x

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir="${1}"

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root="${2}"
test -d "${cache_restore_root}" || mkdir "${cache_restore_root}"

# Cache and execute post install scripts on restore.
execute_install_scripts="${3}"

# Use find instead of ls to better handle non-alphanumeric filenames
cache_filepaths="$(find "${cache_dir}" -mindepth 1 -maxdepth 1 -type f -o -type d | sort)"
file_count=$(echo "${cache_filepaths}" | wc -w)
log "Found ${file_count} files in the cache."
for cache_filepath in ${cache_filepaths}; do
  log "- $(basename "${cache_filepath}")"
done

log_empty_line

log "Reading from main requested packages manifest..."
while IFS= read -r logline; do
  log "- $(echo "${logline}" | tr ':' ' ')"
done < <(tr ',' '\n' < "${cache_dir}/manifest_main.log")
log "done"

log_empty_line

# Only search for archived results. Manifest and cache key also live here.
# Use find instead of ls to better handle non-alphanumeric filenames
cached_filepaths=$(find "${cache_dir}" -maxdepth 1 -name "*.tar" -type f 2>/dev/null | sort)
cached_filecount=$(echo "${cached_filepaths}" | wc -w)

log "Restoring ${cached_filecount} packages from cache..."
for cached_filepath in ${cached_filepaths}; do

  log "- $(basename "${cached_filepath}") restoring..."
  sudo tar -xf "${cached_filepath}" -C "${cache_restore_root}" > /dev/null
  log "  done"

  # Execute install scripts if available.    
  if test "${execute_install_scripts}" == "true"; then
    # May have to add more handling for extracting pre-install script before extracting all files.
    # Keeping it simple for now.
    execute_install_script "${cache_restore_root}" "${cached_filepath}" preinst install
    execute_install_script "${cache_restore_root}" "${cached_filepath}" postinst configure
  fi
done
log "done"
