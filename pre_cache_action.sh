#!/bin/bash

# Directory that holds the cached packages.
cache_dir="${1}"

# Version of the cache to create or load.
version="${2}"

# List of the packages to use.
packages="${@:3}"

# Sort these packages by name and split on commas.
packages=$(echo "${packages}" | sed 's/[\s,]+/ /g' | tr ' ' '\n' | sort | tr '\n' ' ')

# Create cache directory so artifacts can be saved.
mkdir -p "${cache_dir}"

echo -n "Validating action arguments (version='${version}', packages='${packages}')...";

if echo "${version}" | grep -q " " > /dev/null; then
  echo "aborted." 
  echo "Version value '${version}' cannot contain spaces." >&2
  exit 1
fi
if [ "${packages}" == "" ]; then
  echo "aborted." 
  echo "Packages argument cannot be empty." >&2
  exit 2
fi
echo "done."

echo -n "Updating APT package list..."
sudo apt-get update > /dev/null
echo "done."

echo -n "Verifying packages..."
for package in ${packages}; do
  if echo "${package}" | grep -q "="; then
    pkg_name=$(echo "${package}" | cut -d "=" -f1)
    pkg_ver=$(echo "${package}" | cut -d "=" -f2)
  else
    pkg_name="${package}"
  fi
  apt_show=$(apt show "${package}")
  if echo ${apt_show} | grep -qi "No packages found" > /dev/null; then
    echo "aborted."
    echo "Package '${package}' not found." >&2
    exit 3
  fi
  if [ -z "${pkg_ver}" ]; then
    pkg_ver=$(echo "${apt_show}" | grep -Po "(?<=Version: )[^\s]+")
  fi
  package_list="${package_list} ${pkg_name}=${pkg_ver}"
done
echo "done."

# Abort on any failure at this point.
set -e

echo "Creating cache key..."

# Remove extraneous spaces
package_list="$(echo "${package_list}" | sed 's/\s\+/ /g;s/^\s\+//g;s/\s\+$//g')"
echo "- Normalized package list is '$package_list'."

value=$(echo "${package_list} @ ${version}")
echo "- Value to hash is '${value}'."

key=$(echo "${value}" | md5sum | /bin/cut -f1 -d' ')
echo "- Value hashed as '$key'."

echo "done."

key_filepath="${cache_dir}/cache_key.md5"
echo "${key}" > "${key_filepath}"
echo "Hash value written to ${key_filepath}"
