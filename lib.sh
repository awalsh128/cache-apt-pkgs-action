#!/bin/bash

# Sort these packages by name and split on commas.
function normalize_package_list {
  local stripped=$(echo "${1}" | sed 's/,//g')
  # Remove extraneous spaces at the middle, beginning, and end.
  local trimmed="$(echo "${stripped}" | sed 's/\s\+/ /g; s/^\s\+//g; s/\s\+$//g')"
  local sorted="$(echo ${trimmed} | tr ' ' '\n' | sort | tr '\n' ' ')"
  echo "${sorted}"  
}

# Gets a package list of dependencies as common delimited pairs
#   <name>:<version>,<name:version>...
function get_dep_packages {  
  echo $(apt-get install --dry-run --yes "${1}" | \
    grep "^Inst" | sort | awk '{print $2 $3}' | \
    tr '(' ':' | grep -v "${1}:")
}

# Split fully qualified package into name and version
function get_package_name_ver {
  IFS=\: read name ver <<< "${1}"
  # If version not found in the fully qualified package value.
  if test -z "${ver}"; then
    ver="$(grep "Version:" <<< "$(apt show ${name})" | awk '{print $2}')"
  fi
  echo "${name}" "${ver}"
}

function log { echo "$(date +%H:%M:%S)" "${@}"; }

function write_manifest {  
  log "Writing ${1} packages manifest to ${3}..."  
  # 0:-1 to remove trailing comma, delimit by newline and sort
  echo "${2:0:-1}" | tr ',' '\n' | sort > ${3}
  log "done."
}