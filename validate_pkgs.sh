#!/bin/bash

version=$1
packages=${@:2}

echo "::group::Validate Action Arguments";

echo $version | grep -o " " > /dev/null
if [ $? -eq 0 ]; then
  echo "::error::Aborted. Version value '$version' cannot contain spaces." >&2
  exit 1
fi

if [ "$packages" == "" ]; then
  echo "::error::Aborted. Packages argument cannot be empty." >&2
  exit 2
fi

for package in $packages; do
  apt-cache search ^$package$ | grep $package > /dev/null
  if [ $? -ne 0 ]; then
    echo "::error::Aborted. Package '$package' not found." >&2
    exit 3
  fi
done

echo "::endgroup::"
