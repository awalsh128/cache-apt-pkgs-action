#!/bin/bash -x

cache_dir=$1
packages="${@:2}"

validate_args() {
  echo -n "Validating action arguments... ";
  if [ ! -d "$cache_dir" ]; then
    echo "aborted.\nCache directory '$cache_dir' does not exist."
    return 1
  fi
  if [ $packages = "" ]; then
    echo "aborted.\nPackages argument cannot be empty."
    return 2
  fi
  for package in $packages; do
    if apt-cache search ^$package$ | grep $package; then
      echo "aborted.\nPackage '$package' not found."
      return 3
    fi
  done
  echo "done."
  return 0
}

clean_cache() {
  for dir in `ls $cache_dir`; do
    remove=true
    for package in $packages; do
      if [ $dir == $package ]; then
        remove=false
        break
      fi
    done
    [ $remove ] && rm -fr $cache_dir/$dir
  done
}

restore_pkg() {
  package=$1
  package_dir=$2

  echo -n "Restoring $package from cache $package_dir... "
  sudo cp --verbose --force --recursive $package_dir/* /
  sudo apt-get --yes --only-upgrade install $package
  echo "done."
}

install_and_cache_pkg() {
  package=$1
  package_dir=$2

  echo -n "Clean installing $package... "
  sudo apt-get --yes install $package
  echo "done."

  echo -n "Caching $package to $package_dir..."
  mkdir --parents $package_dir
  # Pipe all package files (no folders) to copy command.
  sudo dpkg -L $package | 
    while IFS= read -r f; do 
      if test -f $f; then echo $f; fi;
    done | 
    xargs cp -p -t $package_dir
  echo "done."
}

validate_code = validate_args
if validate_code -ne 0; then
  exit $validate_code
fi

clean_cache

for package in $packages; do
  package_dir=$cache_dir/$package
  if [ -d $package_dir ]; then
    restore_pkg $package $package_dir
  else
    install_and_cache_pkg $package $package_dir
  fi
done

echo "Action complete. ${#packages[@]} packages installed."
