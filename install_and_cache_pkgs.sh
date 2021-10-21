#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1
# List of the packages to use.
packages="${@:2}"

package_count=$(echo $packages | wc -w)
echo "::debug::Clean installing $package_count packages..."
for package in $packages; do
  echo "::debug::- $package"
done
echo "::endgroup::"

mkdir -p $cache_dir

echo "::group::Update APT Package List"
sudo apt-get update
echo "::endgroup::"

for package in $packages; do
  cache_filepath=$cache_dir/$package.tar.gz

  echo "::group::Clean install $package"
  sudo apt-get --yes install $package  
  echo "::endgroup::"

  echo "::group::Caching $package to $cache_filepath"
  # Pipe all package files (no folders) to Tar.
  dpkg -L $package |
    while IFS= read -r f; do 
      if test -f $f; then echo $f; fi;
    done | 
    xargs tar -czf $cache_filepath -C /
  echo "::endgroup::"
done

echo "::group::Finished"
echo "::debug::$(echo $packages | wc -w) package(s) installed and cached."
echo "::endgroup::"
