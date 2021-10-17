#!/bin/bash

# Fail on any error.
set -e

version=$1
packages=${@:2}

echo -n "* Validating action arguments... ";

echo $version | grep -o " " > /dev/null
if [ $? -ne 0 ]; then
    echo "aborted."
    echo "* Version value '$version' cannot contain spaces." >&2
    exit 1
  fi

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
