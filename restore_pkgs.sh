#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2

cache_filepaths=$(ls -1 $cache_dir | sort)
echo "Found $(echo $cache_filepaths | wc -w) files in the cache."
for cache_filepath in $cache_filepaths; do
  echo "- $(basename $cache_filepath)"
done

# Only search for archived results. Manifest and cache key also live here.
cache_pkg_filepaths=$(ls -1 $cache_dir/*.tar.gz | sort)
cache_pkg_filecount=$(echo $cache_pkg_filepaths | wc -w)
echo "Found $cache_pkg_filecount packages in the cache."
for cache_pkg_filepath in $cache_pkg_filepaths; do
  echo "- $(basename $cache_pkg_filepath)"
done

echo "Restoring $cache_pkg_filecount packages from cache..."
for cache_pkg_filepath in $cache_pkg_filepaths; do 
  package=$(basename $cache_pkg_filepath | awk -F. '{print $1}')
  echo "- $package"
  sudo tar -xf $cache_pkg_filepath -C $cache_restore_root > /dev/null
done
echo "done."
