#!/bin/bash

# Fail on any error.
set -e

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir="${1}"

# List of the packages to use.
input_packages="${@:2}"

# Trim commas, excess spaces, and sort.
normalized_packages="$(normalize_package_list "${input_packages}")"

package_count=$(wc -w <<< "${normalized_packages}")
log "Clean installing and caching ${package_count} package(s)."

log_empty_line

manifest_main=""
log "Package list:"
for package in ${normalized_packages}; do
  read package_name package_ver < <(get_package_name_ver "${package}")
  manifest_main="${manifest_main}${package_name}:${package_ver},"  
  log "- ${package_name}:${package_ver}"
done
write_manifest "main" "${manifest_main}" "${cache_dir}/manifest_main.log"

log_empty_line

log "Installing apt-fast for optimized installs..."
# Install apt-fast for optimized installs.
/bin/bash -c "$(curl -sL https://git.io/vokNn)"
log "done"

log_empty_line

log "Updating APT package list..."
sudo apt-fast update > /dev/null
log "done"

log_empty_line

# Strictly contains the requested packages.
manifest_main=""
# Contains all packages including dependencies.
manifest_all=""

install_log_filepath="${cache_dir}/install.log"

log "Clean installing ${package_count} packages..."
# Zero interaction while installing or upgrading the system via apt.
sudo DEBIAN_FRONTEND=noninteractive apt-fast --yes install ${normalized_packages} > "${install_log_filepath}"
log "done"
log "Installation log written to ${install_log_filepath}"

log_empty_line

installed_packages=$(get_installed_packages "${install_log_filepath}")
log "Installed package list:"
for installed_package in ${installed_packages}; do
  log "- ${installed_package}"
done

log_empty_line

installed_package_count=$(wc -w <<< "${installed_packages}")
log "Caching ${installed_package_count} installed packages..."
for installed_package in ${installed_packages}; do
  cache_filepath="${cache_dir}/${installed_package}.tar.gz"

  # Sanity test in case APT enumerates duplicates.
  if test ! -f "${cache_filepath}"; then
    read installed_package_name installed_package_ver < <(get_package_name_ver "${installed_package}")
    log "  * Caching ${installed_package_name} to ${cache_filepath}..."
    # Pipe all package files (no folders) to Tar.
    dpkg -L "${installed_package_name}" |
      while IFS= read -r f; do     
        if test -f $f || test -L $f; then echo "${f:1}"; fi;  #${f:1} removes the leading slash that Tar disallows
      done |
      xargs tar -czf "${cache_filepath}" -C /      
    log "    done (compressed size $(du -h "${cache_filepath}" | cut -f1))."
  fi

  # Comma delimited name:ver pairs in the all packages manifest.
  manifest_all="${manifest_all}${installed_package_name}:${installed_package_ver},"
done
log "done (total cache size $(du -h ${cache_dir} | tail -1 | awk '{print $1}'))"

log_empty_line

write_manifest "all" "${manifest_all}" "${cache_dir}/manifest_all.log"
