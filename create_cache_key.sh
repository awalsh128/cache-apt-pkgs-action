#!/bin/bash

# Fail on any error.
set -e

version=$1
packages=${@:2}

echo "* Creating cache key..."

# Remove package delimiters, sort (requires newline) and then convert back to inline list.
normalized_list=$(echo $packages | sed 's/[\s,]+/ /g' | tr ' ' '\n' | sort | tr '\n' ' ')
echo "* Normalized package list is '$normalized_list'."

value=$(echo $normalized_list @ $version)
echo "* Value to hash is '$value'."

key=$(echo $value | md5sum | /bin/cut -f1 -d' ')
echo "* Value hashed as '$key'."

echo "CACHE_KEY=$key"