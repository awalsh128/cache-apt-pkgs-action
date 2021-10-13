#!/bin/bash

# Exit on any failure.
set -e

# Directory that holds the cached packages.
cache_dir=$1
# Root directory to untar the cached packages to.
# Typically filesystem root '/' but can be changed for testing.
cache_restore_root=$2
# List of the packages to use.
packages="${@:3}"

##############################################################################
# Validate command line arguments.
# Globals:
#   cache_dir
# Arguments:
#   None
# Outputs:
#   None
# Side effects:
#   Exits if validation fails.
##############################################################################
validate_args() {
  echo -n "* Validating action arguments... ";
  if [ "$packages" == "" ]; then
    echo "aborted."
    echo "* Packages argument cannot be empty." >&2
    exit 2
  fi
  for package in $packages; do
    apt-cache search ^$package$ | grep $package > /dev/null
    if [ $? -ne 0 ]; then
      echo "aborted."
      echo "* Package '$package' not found." >&2
      exit 3
    fi
  done
  echo "done."
}

##############################################################################
# Get cached package file path.
# Globals:
#   cache_dir
# Arguments:
#   package name
# Outputs:
#   Writes cached package file path to stdout.
##############################################################################
get_cache_filepath() {  
  echo "$cache_dir/$1.tar.gz"
}

##############################################################################
# Clean the cache directory of unused packages.
# Globals:
#   cache_dir
# Arguments:
#   None
# Outputs:
#   None
# Side effects:
#   Removes unused cached packages from filesystem.
##############################################################################
clean_cache() {
  for listed_filepath in $(find $cache_dir -maxdepth 1 -type f); do
    remove=true
    for package in $packages; do
      cache_filepath=$(get_cache_filepath $package)
      if [ $listed_filepath == $cache_filepath ]; then
        remove=false
        break
      fi
    done    
    if [ $remove == true ]; then
      rm -f $listed_filepath
      echo "* Removed unused cached file $listed_filepath."
    fi
  done
}

##############################################################################
# Restore cached package.
# Globals:
#   cache_restore_root
# Arguments:
#   package
# Outputs:
#   None
# Side effects;
#   Untars files to filesystem and performs an APT upgrade.
##############################################################################
restore_pkg() {
  package=$1
  cache_filepath=$(get_cache_filepath $package)

  echo "* Restoring $package from cache $cache_filepath... "
  tar -xf $cache_filepath -C $cache_restore_root
  sudo apt-get --yes --only-upgrade install $package
}

##############################################################################
# Install package and cache it to the filesystem.
# Globals:
#   None
# Arguments:
#   package
# Outputs:
#   None
# Side effects;
#   Performs an APT install of the package and creates the cached package.
##############################################################################
install_and_cache_pkg() {
  package=$1
  cache_filepath=$(get_cache_filepath $package)

  echo "* Clean installing $package... "
  sudo apt-get --yes install $package  

  echo "* Caching $package to $cache_filepath..."
  # Pipe all package files (no folders) to Tar.
  dpkg -L $package |
    while IFS= read -r f; do 
      if test -f $f; then echo $f; fi;
    done | 
    xargs tar -czf $cache_filepath -C /
}

validate_args

if [ -d $cache_dir ]; then
  clean_cache
else
  # Initial run of action; no directory will exist.
  mkdir -p $cache_dir
fi

for package in $packages; do
  echo "* Processing package $package..."
  cache_filepath=$(get_cache_filepath $package)
  echo $cache_filepath
  if [ -f $cache_filepath ]; then
    restore_pkg $package
  else
    install_and_cache_pkg $package
  fi
done

echo "Action complete. ${#packages[@]} package(s) installed."
