#!/bin/bash

# Fail on any error.
set -e

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Install apt-fast for optimized installs.
/bin/bash -c "$(curl -sL https://git.io/vokNn)"

# Directory that holds the cached packages.
cache_dir="${1}"

# List of the packages to use.
input_packages="${@:2}"

# Trim commas, excess spaces, and sort.
normalized_packages="$(normalize_package_list "${input_packages}")"

package_count=$(wc -w <<< "${normalized_packages}")
log "Clean installing and caching ${package_count} package(s)."

log_empty_line

log "Package list:"
for package in ${normalized_packages}; do
  log "- ${package}"
done

log_empty_line

log "Updating APT package list..."
sudo apt-fast update > /dev/null
log "done"

log_empty_line

# Strictly contains the requested packages.
manifest_main=""
# Contains all packages including dependencies.
manifest_all=""

log "Gathering install information for ${package_count} packages..."
log_empty_line
cached_packages=""
for package in ${normalized_packages}; do
  read package_name package_ver < <(get_package_name_ver "${package}")    

  # Comma delimited name:ver pairs in the main requested packages manifest.
  manifest_main="${manifest_main}${package_name}:${package_ver},"

  cached_packages="${cached_packages} ${package_name}:${package_version}"
  read dep_packages < <(get_dep_packages "${package_name}")
  cached_packages="${cached_packages} $(echo ${dep_packages} | tr '\n' ' ')"

  if test -z "${dep_packages}"; then
    dep_packages_text="none";
  else
    dep_packages_text="${dep_packages}"
  fi

  log "- ${package_name}"
  log "  * Version: ${package_ver}"
  log "  * Dependencies: ${dep_packages_text}"
  log_empty_line
done
log "done"

log_empty_line

log "Clean installing ${package_count} packages..."
# Zero interaction while installing or upgrading the system via apt.
sudo DEBIAN_FRONTEND=noninteractive apt-fast --yes install ${normalized_packages} > /dev/null
log "done"

log_empty_line

cached_package_count=$(wc -w <<< "${cached_packages}")
log "Caching ${cached_package_count} installed packages..."
for cached_package in ${cached_packages}; do
  cache_filepath="${cache_dir}/${cached_package}.tar.gz"

  if test ! -f "${cache_filepath}"; then
    read cached_package_name cached_package_ver < <(get_package_name_ver "${cached_package}")
    log "  * Caching ${cached_package_name} to ${cache_filepath}..."
    # Pipe all package files (no folders) to Tar.
    dpkg -L "${cached_package_name}" |
      while IFS= read -r f; do     
        if test -f $f || test -L $f; then echo "${f:1}"; fi;  #${f:1} removes the leading slash that Tar disallows
      done |
      xargs tar -czf "${cache_filepath}" -C /      
    log "    done (compressed size $(du -h "${cache_filepath}" | cut -f1))."
  fi

  # Comma delimited name:ver pairs in the all packages manifest.
  manifest_all="${manifest_all}${cached_package_name}:${cached_package_ver},"
done
log "done (total cache size $(du -h ${cache_dir} | tail -1 | awk '{print $1}'))"

log_empty_line

write_manifest "all" "${manifest_all}" "${cache_dir}/manifest_all.log"
write_manifest "main" "${manifest_main}" "${cache_dir}/manifest_main.log"
