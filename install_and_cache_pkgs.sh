#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir="${1}"

# List of the packages to use.
packages="${@:2}"

# Sort these packages by name and split on commas.
packages=$(echo "${packages}" | sed 's/[\s,]+/ /g' | tr ' ' '\n' | sort | tr '\n' ' ')

# Remove extraneous spaces
packages="$(echo "${packages}" | sed 's/\s\+/ /g;s/^\s\+//g;s/\s\+$//g')"

package_count=$(echo "${packages}" | wc -w)
echo "Clean installing and caching ${package_count} package(s)."
echo "Package list:"
for package in ${packages}; do
  echo "- ${package}"
done

echo -n "Updating APT package list..."
sudo apt-get update > /dev/null
echo "done."

manifest=
echo "Clean installing and caching ${package_count} packages..."
for package in ${packages}; do
  echo "- ${package}"
  echo -n "  Installing..."

  # Gather a list of all packages apt installs to make this package work
  required_packages=$(apt-get install --dry-run --yes "${package}" | grep -Po "(?<=Inst )[^\s]+" || echo "${package}")
  echo "Package ${package} installs the following packages: ${required_packages//$'\n'/, }"
  sudo DEBIAN_FRONTEND=noninteractive apt-get --yes install "${package}" > /dev/null

  echo "done."

  for cache_package in ${required_packages}; do
    cache_filepath="${cache_dir}/${cache_package}.tar.gz"
    if [ ! -f "${cache_filepath}" ]; then
      package_name="$(echo "${cache_package}" | cut -d"=" -f1)"
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
# Remove trailing comma.
echo ${manifest:0:-1} > ${manifest_filepath}
echo "done."