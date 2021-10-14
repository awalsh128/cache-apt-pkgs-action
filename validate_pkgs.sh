#!/bin/bash

packages=$1

echo -n "* Validating action arguments... ";
if [ "$packages" == "" ]; then
  echo "aborted."
  echo "* Packages argument cannot be empty." >&2
  exit 1
fi
for package in $packages; do
  apt-cache search ^$package$ | grep $package > /dev/null
  if [ $? -ne 0 ]; then
    echo "aborted."
    echo "* Package '$package' not found." >&2
    exit 2
  fi
done
echo "done."
