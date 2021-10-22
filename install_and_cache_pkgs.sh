#!/bin/bash

# Fail on any error.
set -e

# Directory that holds the cached packages.
cache_dir=$1

# List of the packages to use.
packages="${@:2}"

package_count=$(echo $packages | wc -w)
echo "Clean installing and caching $package_count package(s).\n"
echo "Package list:"
for package in $packages; do
  echo "- $package"
done
echo ""

echo -n "Updating APT package list..."
sudo apt-get update > /dev/null
echo "done."

for package in $packages; do
  cache_filepath=$cache_dir/$package.tar.gz

  echo -n "Clean installing $package..."
  sudo apt-get --yes install $package > /dev/null
  echo "done."

  echo -n "Caching $package to $cache_filepath..."
  # Pipe all package files (no folders) to Tar.
  dpkg -L $package |
    while IFS= read -r f; do     
      if test -f $f; then echo ${f:1}; fi;  #${f:1} removes the leading slash that Tar disallows
    done | 
    xargs tar -czf $cache_filepath -C /    
  echo "done."
done

echo "$(echo $packages | wc -w) package(s) installed and cached."
