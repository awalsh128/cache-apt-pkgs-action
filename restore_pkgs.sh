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

cache_filenames=$(ls -1 $cache_dir | sort)
cache_filename_count=$(echo $cache_filenames | wc -w)
echo "* Found $cache_filename_count files in cache..."
for cache_filename in $cache_filenames; do
  echo "  - $cache_filename"
done

for package in $packages; do
  cache_filepath=$cache_dir/$package.tar.gz
  echo "* Restoring package $package ($cache_filepath) from cache... "
  sudo tar -xf $cache_filepath -C $cache_restore_root
done

echo "Action complete. $cache_filename_count package(s) restored."
