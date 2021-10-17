#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1
# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2

for cache_filepath in $(ls $cache_dir); do
  echo "* Restoring $cache_filepath from cache... "
  sudo tar -xf $cache_filepath -C $cache_restore_root  
done
# Update all packages.
sudo apt-get --yes --only-upgrade install

echo "Action complete. $(ls -l $cache_dir | wc -l) package(s) restored."
