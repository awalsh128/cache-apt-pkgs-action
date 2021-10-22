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
echo "Found $(echo $cache_filenames | wc -w) files in the cache."
for cache_filename in $cache_filenames; do
  echo "- $(basename $cache_filename)"
done

# Only search for archived results. Manifest and cache key also live here.
cache_pkg_filenames=$(ls -1 $cache_dir/*.tar.gz | sort)
echo "Found $(echo $cache_filenames | wc -w) packages in the cache."
for cache_pkg_filename in $cache_pkg_filenames; do
  echo "- $(basename $cache_pkg_filename)"
done

echo "Restoring $cache_filename_count packages from cache..."
for cache_pkg_filename in $cache_pkg_filenames; do
  cache_pkg_filepath=$cache_dir/$package.tar.gz
  echo "- $package ($(basename $cache_pkg_filepath))"
  sudo tar -xf $cache_pkg_filepath -C $cache_restore_root > /dev/null
done
echo "done."
