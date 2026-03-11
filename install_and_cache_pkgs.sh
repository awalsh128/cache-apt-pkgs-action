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

# Repositories to add before installing packages.
add_repository="${3}"

# GPG-signed third-party repository sources.
apt_sources="${4}"

# List of the packages to use.
input_packages="${@:5}"

if ! apt-fast --version > /dev/null 2>&1; then
  log "Installing apt-fast for optimized installs..."
  # Install apt-fast for optimized installs.
  /bin/bash -c "$(curl -sL https://raw.githubusercontent.com/ilikenwf/apt-fast/master/quick-install.sh)"
  log "done"

  log_empty_line
fi

# Add custom repositories if specified
if [ -n "${add_repository}" ]; then
  log "Adding custom repositories..."
  for repository in ${add_repository}; do
    log "- Adding repository: ${repository}"
    sudo apt-add-repository -y "${repository}"
  done
  log "done"
  log_empty_line
fi

# Set up GPG-signed third-party apt sources if specified
setup_apt_sources "${apt_sources}"

log "Updating APT package list..."
# Force update when custom sources were added — the staleness check only
# reflects the last update, which may predate the newly added repos.
if [ -n "${apt_sources}" ] || [ -n "${add_repository}" ] || [[ -z "$(find -H /var/lib/apt/lists -maxdepth 0 -mmin -5)" ]]; then
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
# Explicitly check exit status since set +e (from lib.sh) is active.
sudo DEBIAN_FRONTEND=noninteractive apt-fast --yes install ${packages} 2>&1 | tee "${install_log_filepath}"
install_rc=${PIPESTATUS[0]}

if [ "${install_rc}" -ne 0 ]; then
  log_err "Failed to install packages. apt-fast exited with an error (see messages above)."
  exit 5
fi
log "Install completed successfully."

log_empty_line

installed_packages=$(get_installed_packages "${install_log_filepath}")
installed_packages_count=$(wc -w <<< "${installed_packages}")
log "Caching ${installed_packages_count} installed packages..."
for installed_package in ${installed_packages}; do
  cache_filepath="${cache_dir}/${installed_package}.tar"

  # Sanity test in case APT enumerates duplicates.
  if test ! -f "${cache_filepath}"; then
    read package_name package_ver < <(get_package_name_ver "${installed_package}")
    log "  * Caching ${package_name} to ${cache_filepath}..."

    # Pipe all package files, directories, and symlinks (plus symlink targets
    # and dpkg metadata) to Tar.  Directories are included so that tar
    # preserves their ownership and permissions on restore — without them,
    # tar auto-creates parent directories using the current umask, which on
    # some runners (e.g. GPU-optimized images) defaults to 0077, leaving
    # restored trees inaccessible to non-root users.
    tar -cf "${cache_filepath}" -C / --no-recursion --verbatim-files-from --files-from <(
      { dpkg -L "${package_name}" | grep -vxF -e '/.' -e '.' -e '/' &&
        # Include all dpkg info files for this package (list, md5sums,
        # conffiles, triggers, preinst, postinst, prerm, postrm, etc.)
        # so dpkg recognizes the package after cache restore.
        ls -1 /var/lib/dpkg/info/${package_name}.* 2>/dev/null &&
        ls -1 /var/lib/dpkg/info/${package_name}:*.* 2>/dev/null ; } |
      while IFS= read -r f; do
        if [ -f "${f}" ] || [ -L "${f}" ] || [ -d "${f}" ]; then
          echo "${f#/}"
          if [ -L "${f}" ]; then
            target="$(readlink -f "${f}")"
            if [ -f "${target}" ]; then
              echo "${target#/}"
            fi
          fi
        fi
      done
    )

    # Save the dpkg status entry so we can register the package on restore.
    dpkg -s "${package_name}" > "${cache_dir}/${installed_package}.dpkg-status" 2>/dev/null || true

    log "    done (compressed size $(du -h "${cache_filepath}" | cut -f1))."
  fi

  # Comma delimited name:ver pairs in the all packages manifest.
  manifest_all="${manifest_all}${package_name}=${package_ver},"
done
log "done (total cache size $(du -h ${cache_dir} | tail -1 | awk '{print $1}'))"

log_empty_line

write_manifest "all" "${manifest_all}" "${cache_dir}/manifest_all.log"
