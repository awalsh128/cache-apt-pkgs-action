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

echo "::group::Found $cache_filename_count files in cache."
for cache_filename in $cache_filenames; do
  echo "::debug::$cache_filename"
done
echo "::endgroup::"

echo "::group::Package Restore"
for package in $packages; do
  cache_filepath=$cache_dir/$package.tar.gz
  echo "::debug::Restoring package $package ($cache_filepath) from cache... "
  sudo tar -xf $cache_filepath -C $cache_restore_root
  # Upgrade the install from last state.
  # TODO(awalsh128) Add versioning to cache key creation.
  sudo apt-get --yes --only-upgrade install $package
done
echo "::endgroup::"

echo "::group::Finished"
echo "::debug::Action complete. $cache_filename_count package(s) restored."
echo "::endgroup::"