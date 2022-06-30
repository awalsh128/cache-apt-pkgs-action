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

package_count=$(echo "${normalized_packages}" | wc -w)
echo "Clean installing and caching ${package_count} package(s)."
echo "Package list:"
for package in ${normalized_packages}; do
  echo "- ${package}"
done

echo -n "Updating APT package list..."
sudo apt-get update > /dev/null
echo "done."

manifest=""
echo "Clean installing and caching ${package_count} packages..."
for package in ${normalized_packages}; do
  read package_name package_ver < <(get_package_name_ver "${package}")
  package_deps="$(apt-get install --dry-run --yes "${package_name}" | grep "^Inst" | awk '{print $2}')"

  echo "- ${package_name}"
  echo "  * Version: ${package_ver}"
  echo "  * Dependencies: ${package_deps}"
  echo -n "  * Installing..."
  # Zero interaction while installing or upgrading the system via apt.
  sudo DEBIAN_FRONTEND=noninteractive apt-get --yes install "${package}" > /dev/null
  echo "done."

  for cache_package in ${package_deps}; do
    cache_filepath="${cache_dir}/${cache_package}.tar.gz"

    if test ! -f "${cache_filepath}"; then
      get_package_name_ver "${cache_package}" # -> package_name, package_ver      
      echo -n "  Caching ${package_name} to ${cache_filepath}..."
      # Pipe all package files (no folders) to Tar.
      dpkg -L "${package_name}" |
        while IFS= read -r f; do     
          if test -f $f; then echo "${f:1}"; fi;  #${f:1} removes the leading slash that Tar disallows
        done | 
        xargs tar -czf "${cache_filepath}" -C /    
      echo "done."
      # Add package to manifest
      manifest="${manifest}${package_name}:$(dpkg -s "${package_name}" | grep Version | awk '{print $2}'),"
    fi
  done
done
echo "done."

manifest_filepath="${cache_dir}/manifest.log"
echo -n "Writing package manifest to ${manifest_filepath}..."
# Remove trailing comma and write to manifest file.
echo "${manifest:0:-1}" > "${manifest_filepath}"
echo "done."