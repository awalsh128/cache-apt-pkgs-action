#!/bin/bash

# Directory that holds the cached packages.
cache_dir=$1

# Version of the cache to create or load.
version=$2

# List of the packages to use.
packages=${@:3}

# Create cache directory so artifacts can be saved.
mkdir -p $cache_dir

echo -n "Validating action arguments (version='$version', packages='$packages')...";
echo $version | grep -o " " > /dev/null
if [ $? -eq 0 ]; then
  echo "aborted." 
  echo "Version value '$version' cannot contain spaces." >&2
  exit 1
fi
if [ "$packages" == "" ]; then
  echo "aborted." 
  echo "Packages argument cannot be empty." >&2
  exit 2
fi
echo "done."

echo -n "Verifying packages..."
for package in $packages; do
  escaped=$(echo $package | sed 's/+/\\+/g')
  apt-cache search ^$escaped$ | grep $package > /dev/null
  if [ $? -ne 0 ]; then
    echo "aborted."
    echo "Package '$package' not found." >&2
    exit 3
  fi
done
echo "done."

# Abort on any failure at this point.
set -e

echo "Creating cache key..."

# Remove package delimiters, sort (requires newline) and then convert back to inline list.
normalized_list=$(echo $packages | sed 's/[\s,]+/ /g' | tr ' ' '\n' | sort | tr '\n' ' ')
echo "- Normalized package list is '$normalized_list'."

value=$(echo $normalized_list @ $version)
echo "- Value to hash is '$value'."

key=$(echo $value | md5sum | /bin/cut -f1 -d' ')
echo "- Value hashed as '$key'."

echo "done."

key_filepath="$cache_dir/cache_key.md5"
echo $key > $key_filepath
echo "Hash value written to $key_filepath"
