#!/bin/bash

# Fail on any error.
set -e

# Debug mode for diagnosing issues.
# Setup first before other operations.
debug="${2}"
test "${debug}" = "true" && set -x

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir="${1}"

# List of the packages to use.
input_packages="${@:3}"

if ! apt-fast --version > /dev/null 2>&1; then
  log "Installing apt-fast for optimized installs..."
  # Install apt-fast for optimized installs.
  /bin/bash -c "$(curl -sL https://git.io/vokNn)"
  log "done"

  log_empty_line
fi

log "Updating APT package list..."
if [[ -z "$(find -H /var/lib/apt/lists -maxdepth 0 -mmin -5)" ]]; then
  sudo apt-fast update > /dev/null
  log "done"
else
  log "skipped (fresh within at least 5 minutes)"
fi

log_empty_line

packages="$(get_normalized_package_list "${input_packages}")"
package_count=$(wc -w <<< "${packages}")
log "Clean installing and caching ${package_count} package(s)."

log_empty_line

manifest_main=""
log "Package list:"
for package in ${packages}; do
  manifest_main="${manifest_main}${package},"
  log "- ${package}"
done
write_manifest "main" "${manifest_main}" "${cache_dir}/manifest_main.log"

log_empty_line

# Strictly contains the requested packages.
manifest_main=""
# Contains all packages including dependencies.
manifest_all=""

install_log_filepath="${cache_dir}/install.log"

log "Clean installing ${package_count} packages..."
# Zero interaction while installing or upgrading the system via apt.
sudo DEBIAN_FRONTEND=noninteractive apt-fast --yes install ${packages} > "${install_log_filepath}"
log "done"
log "Installation log written to ${install_log_filepath}"

log_empty_line

installed_packages=$(get_installed_packages "${install_log_filepath}")
log "Installed package list:"
for installed_package in ${installed_packages}; do
  # Reformat for human friendly reading.  
  log "- $(echo ${installed_package} | awk -F\= '{print $1" ("$2")"}')"
done

log_empty_line

installed_packages_count=$(wc -w <<< "${installed_packages}")
log "Caching ${installed_packages_count} installed packages..."
for installed_package in ${installed_packages}; do
  cache_filepath="${cache_dir}/${installed_package}.tar"

  # Sanity test in case APT enumerates duplicates.
  if test ! -f "${cache_filepath}"; then
    read package_name package_ver < <(get_package_name_ver "${installed_package}")
    log "  * Caching ${package_name} to ${cache_filepath}..."

    # Pipe all package files (no folders) and installation control data to Tar.
    tar -cf "${cache_filepath}" -C / --verbatim-files-from --files-from <( { dpkg -L "${package_name}" &&
      get_install_script_filepath "" "${package_name}" "preinst" &&
      get_install_script_filepath "" "${package_name}" "postinst" ;} |
      while IFS= read -r f; do test -f "${f}" -o -L "${f}" && get_tar_relpath "${f}"; done )

    log "    done (compressed size $(du -h "${cache_filepath}" | cut -f1))."
  fi

  # Comma delimited name:ver pairs in the all packages manifest.
  manifest_all="${manifest_all}${package_name}=${package_ver},"
done
log "done (total cache size $(du -h ${cache_dir} | tail -1 | awk '{print $1}'))"

log_empty_line

write_manifest "all" "${manifest_all}" "${cache_dir}/manifest_all.log"
