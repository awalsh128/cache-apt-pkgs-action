#!/bin/bash

# Fail on any error.
set -e

# Debug mode for diagnosing issues.
# Setup first before other operations.
debug="${4}"
test ${debug} == "true" && set -x

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir="${1}"

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root="${2}"
test -d ${cache_restore_root} || mkdir ${cache_restore_root}

# Cache and execute post install scripts on restore.
execute_install_scripts="${3}"

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
cached_filepaths=$(ls -1 "${cache_dir}"/*.tar 2>/dev/null | sort)
cached_filecount=$(echo ${cached_filepaths} | wc -w)

log "Restoring ${cached_filecount} packages from cache..."
for cached_filepath in ${cached_filepaths}; do

  log "- $(basename "${cached_filepath}") restoring..."
  sudo tar -xf "${cached_filepath}" -C "${cache_restore_root}" > /dev/null
  log "  done"

  # Execute install scripts if available.
  if test ${execute_install_scripts} == "true"; then
    # May have to add more handling for extracting pre-install script before extracting all files.
    # Keeping it simple for now.
    execute_install_script "${cache_restore_root}" "${cached_filepath}" preinst install
    execute_install_script "${cache_restore_root}" "${cached_filepath}" postinst configure
  fi
done
log "done"

log_empty_line

# Register packages with dpkg so they appear as installed.
# The tar extraction restores dpkg info files (list, md5sums, etc.) but the
# main status database (/var/lib/dpkg/status) also needs updating.
dpkg_status_dir="${cache_dir}"
status_files=$(ls -1 "${dpkg_status_dir}"/*.dpkg-status 2>/dev/null || true)
if test -n "${status_files}"; then
  log "Registering restored packages with dpkg..."
  for status_file in ${status_files}; do
    pkg_name=$(head -1 "${status_file}" | sed 's/^Package: //')
    # Skip if dpkg already knows about this package (e.g., it was pre-installed).
    if dpkg -s "${pkg_name}" > /dev/null 2>&1; then
      existing_status=$(dpkg -s "${pkg_name}" 2>/dev/null | grep '^Status:' | head -1)
      if echo "${existing_status}" | grep -q 'install ok installed'; then
        log "- ${pkg_name} already registered, skipping."
        continue
      fi
    fi
    # Append the status entry (with blank line separator) to the dpkg database.
    echo "" | sudo tee -a "${cache_restore_root}var/lib/dpkg/status" > /dev/null
    cat "${status_file}" | sudo tee -a "${cache_restore_root}var/lib/dpkg/status" > /dev/null
    log "- ${pkg_name} registered."
  done
  log "done"
fi
