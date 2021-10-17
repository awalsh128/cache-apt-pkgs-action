#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1
# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2

cache_filenames=$(ls -1 $cache_dir | sort)
echo "* Found ${#cache_filenames[@]} files in cache..."
echo $cache_filenames

for cache_filename in $cache_filenames; do
  cache_filepath=$cache_dir/$cache_filename
  echo "* Restoring $cache_filepath from cache... "
  sudo tar -xf $cache_filepath -C $cache_restore_root  
done
# Update all packages.
sudo apt-get --yes --only-upgrade install

echo "Action complete. $(echo $cache_filenames | wc -l) package(s) restored."
