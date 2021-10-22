#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1

# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2

# Indicates that the cache was found.
cache_hit=$3

# Indicates that a refresh of the packages in the cache is required.
refresh=$4

# List of the packages to use.
packages="${@:5}"

script_dir=$(dirname $0)

if [ ! $cache_hit ] || [ $refresh ]; then
  $script_dir/install_and_cache_pkgs.sh ~/cache-apt-pkgs $packages
else
  $script_dir/restore_pkgs.sh ~/cache-apt-pkgs $cache_restore_root
fi
echo ""

echo "Creating package manifest..."
manifest=
for package in $packages; do
  item=$package:$(dpkg -s $package | grep Version | awk '{print $2}')
  echo "- $item"
  manifest=$manifest$item,
done
echo "done."

manifest_filepath="$cache_dir/manifest.log"
echo -n "Writing manifest to $manifest_filepath..."
# Remove trailing comma.
echo ${manifest:0:-1} > $manifest_filepath
echo "done."