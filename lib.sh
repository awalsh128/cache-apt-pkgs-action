#!/bin/bash

# Sort these packages by name and split on commas.
function normalize_package_list {
  local stripped=$(echo "${1}" | sed 's/,//g')
  # Remove extraneous spaces at the middle, beginning, and end.
  local trimmed="$(echo "${stripped}" | sed 's/\s\+/ /g; s/^\s\+//g; s/\s\+$//g')"  
  echo "${trimmed}" | sort
}

# Split fully qualified package into name and version
function get_package_name_ver {
  IFS=\= read name ver <<< "${1}"
  # If version not found in the fully qualified package value.
  if test -z "${ver}"; then
    ver="$(grep "Version:" <<< "$(apt show ${name})" | awk '{print $2}')"
  fi
  echo "${name}" "${ver}"
}

function log { echo "$(date +%H:%M:%S)" "${@}"; }