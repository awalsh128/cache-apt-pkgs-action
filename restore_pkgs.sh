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
cache_restore_root="${2}"

# Cache and execute post install scripts on restore.
execute_postinst="${3}"

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

# Post install script restore location.
postint_filepath="/tmp/deb-ctrl-data/postinst"

log "Restoring ${cached_pkg_filecount} packages from cache..."
for cached_pkg_filepath in ${cached_pkg_filepaths}; do
  log "- $(basename "${cached_pkg_filepath}") restoring..."

  sudo tar -xf "${cached_pkg_filepath}" -C "${cache_restore_root}" > /dev/null

  if test "${execute_postinst}" == "true"; then
    # Execute post install script if available.
    if test -f "${postint_filepath}"; then
      sh -x ${postint_filepath}
      rm -fr ${postint_filepath}
    fi
  fi

  log "  done"
done
log "done"
