#!/bin/bash

# Directory that holds the cached packages.
cache_dir=$1
# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2

for cache_filepath in $(ls $cache_dir); do
  echo "* Restoring $package from cache $cache_filepath... "
  sudo tar -xf $cache_filepath -C $cache_restore_root
  sudo apt-get --yes --only-upgrade install $package
fi

echo "Action complete. ${#packages[@]} package(s) restored."
