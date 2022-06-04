#!/bin/bash

# Include library.
script_dir="$(dirname -- "$(realpath -- "${0}")")"
source "${script_dir}/lib.sh"

# Directory that holds the cached packages.
cache_dir=$1

# Version of the cache to create or load.
version=$2

# List of the packages to use.
input_packages="${@:3}"

# Trim commas, excess spaces, and sort.
packages="$(normalize_package_list "${input_packages}")"

# Create cache directory so artifacts can be saved.
mkdir -p $cache_dir

echo -n "Validating action arguments (version='$version', packages='$packages')...";
if grep -q " " <<< "${cache_version}"; then
  echo "aborted." 
  echo "Version value '$version' cannot contain spaces." >&2
  exit 1
fi

# Is length of string zero?
if test -z "${packages}"; then
  echo "aborted." 
  echo "Packages argument cannot be empty." >&2
  exit 2
fi
echo "done."

versioned_packages=""
echo -n "Verifying packages..."
for package in ${packages}; do 
  if test ! "$(apt show "${package}")"; then
    echo "aborted."
    echo "Package '$package' not found." >&2
    exit 3
  fi
  get_package_name_ver "${package}" # -> package_name, package_ver  
  versioned_packages="${versioned_packages} ${package_name}=${package_ver}"
done
echo "done."

# Abort on any failure at this point.
set -e

echo "Creating cache key..."

# TODO Can we prove this will happen again?
normalized_versioned_packages="$(normalize_package_list "${versioned_packages}")"
echo "- Normalized package list is '${normalized_versioned_packages}'."

value="$(echo "${normalized_versioned_packages} @ ${cache_version}")"
echo "- Value to hash is '${value}'."

key="$(echo "${value}" | md5sum | /bin/cut -f1 -d' ')"
echo "- Value hashed as '${key}'."

echo "done."

key_filepath="$cache_dir/cache_key.md5"
echo $key > $key_filepath
echo "Hash value written to $key_filepath"
