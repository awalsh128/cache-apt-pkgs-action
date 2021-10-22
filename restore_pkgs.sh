#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2

# List of the packages to use.
packages="${@:3}"

# Only search for archived results. Manifest and cache key also live here.
cache_filenames=$(ls -1 $cache_dir | grep .tar.gz | sort)
cache_filename_count=$(echo $cache_filenames | wc -w)

echo "Found $cache_filename_count packages in cache."
for cache_filename in $cache_filenames; do
  echo "- $cache_filename"
done

echo -n "Restoring cached packages..."
for package in $packages; do
  cache_filepath=$cache_dir/$package.tar.gz
  echo "- $package ($cache_filepath)"
  sudo tar -xf $cache_filepath -C $cache_restore_root > /dev/null
done
echo "done."

echo "$cache_filename_count package(s) restored."