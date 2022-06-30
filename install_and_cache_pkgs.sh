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
echo "Clean installing and caching ${package_count} package(s)."
echo "Package list:"
for package in ${normalized_packages}; do
  echo "- ${package}"
done

echo -n "Updating APT package list..."
sudo apt-get update > /dev/null
echo "done."

# Strictly contains the requested packages.
manifest_main=""
# Contains all packages including dependencies.
manifest_all=""

echo "Clean installing and caching ${package_count} packages..."
for package in ${normalized_packages}; do
  read package_name package_ver < <(get_package_name_ver "${package}")  

  # Comma delimited name:ver pairs in the main requested packages manifest.
  manifest_main="${manifest_main}${package_name}:${package_ver},"

  all_packages="$(apt-get install --dry-run --yes "${package_name}" | grep "^Inst" | awk '{print $2}')"
  dep_packages="$(echo ${dep_packages} | grep -v "${package_name}" | tr '\n' ,)"

  echo "- ${package_name}"
  echo "  * Version: ${package_ver}"
  echo "  * Dependencies: ${dep_packages:0:-1}"
  echo -n "  * Installing..."
  # Zero interaction while installing or upgrading the system via apt.
  sudo DEBIAN_FRONTEND=noninteractive apt-get --yes install "${package}" > /dev/null
  echo "done."

  for cache_package in ${all_packages}; do
    cache_filepath="${cache_dir}/${cache_package}.tar.gz"

    if test ! -f "${cache_filepath}"; then
      read cache_package_name cache_package_ver < <(get_package_name_ver "${cache_package}")
      echo -n "  * Caching ${cache_package_name} to ${cache_filepath}..."
      # Pipe all package files (no folders) to Tar.
      dpkg -L "${cache_package_name}" |
        while IFS= read -r f; do     
          if test -f $f; then echo "${f:1}"; fi;  #${f:1} removes the leading slash that Tar disallows
        done | 
        xargs tar -czf "${cache_filepath}" -C /      
      echo "done (compressed size $(du -k "${cache_filepath}" | cut -f1))."
    fi

    # Comma delimited name:ver pairs in the all packages manifest.
    manifest_all="${manifest_all}${cache_package_name}:${cache_package_ver},"
  done  
done
echo "done."

manifest_all_filepath="${cache_dir}/manifest_all.log"
echo -n "Writing all packages manifest to ${manifest_all_filepath}..."
# Remove trailing comma and write to manifest_all file.
echo "${manifest_all:0:-1}" > "${manifest_all_filepath}"
echo "done."

manifest_main_filepath="${cache_dir}/manifest_main.log"
echo -n "Writing main requested packages manifest to ${manifest_main_filepath}..."
# Remove trailing comma and write to manifest_main file.
echo "${manifest_main:0:-1}" > "${manifest_main_filepath}"
echo "done."