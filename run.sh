#!/bin/bash -x

cache_dir=$1
packages="${@:2}"

if [ ! -d "$cache_dir" ]; then
  echo "Cache directory '$cache_dir' does not exist."
  exit 1
fi
if [ $packages = "" ]; then
  echo "Packages argument cannot be empty."
  exit 2
fi

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

for package in $packages; do
 
  package_dir=$cache_dir/$package

  if [ -d $package_dir ]; then
  
    echo "Restoring $package from cache $package_dir..."    
    sudo cp --verbose --force --recursive $package_dir/* /
    sudo apt-get --yes --only-upgrade install $package

  else

    echo "Clean install $package and caching to $package_dir..."
    sudo apt-get --yes install $package

    echo "Caching $package to $package_dir..."
    mkdir --parents $package_dir
    # Pipe all package files (no folders) to copy command.
    sudo dpkg -L $package | 
      while IFS= read -r f; do 
        if test -f $f; then echo $f; fi;
      done | 
      xargs cp -p -t $package_dir
  fi

done
