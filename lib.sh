#!/bin/bash

# Sort these packages by name and split on commas.
function normalize_package_list {
  local stripped=$(echo "${1}" | sed 's/,//g')
  # Remove extraneous spaces at the middle, beginning, and end.
  local trimmed="$(echo "${stripped}" | sed 's/\s\+/ /g; s/^\s\+//g; s/\s\+$//g')"
  local sorted="$(echo ${trimmed} | tr ' ' '\n' | sort | tr '\n' ' ')"
  echo "${sorted}"  
}

# Gets a list of installed packages as space delimited pairs with each pair colon delimited.
#   <name>:<version> <name:version>...
function get_installed_packages {   
  install_log_filepath="${1}"
  local regex="^Unpacking ([^ ]+) (\[[^ ]+\]\s)?\(([^ )]+)"
  dep_packages=""  
  while read -r line; do
    if [[ "${line}" =~ ${regex} ]]; then
      dep_packages="${dep_packages}${BASH_REMATCH[1]}:${BASH_REMATCH[3]} "      
    else
      log_err "Unable to parse package name and version from \"$line\""
      exit 2
    fi
  done < <(grep "^Unpacking " ${install_log_filepath})
  if test -n "${dep_packages}"; then
    echo "${dep_packages:0:-1}"  # Removing trailing space.
  else
    echo ""
  fi
}

# Split fully qualified package into name and version.
function get_package_name_ver {
  IFS=\: read name ver <<< "${1}"
  # If version not found in the fully qualified package value.
  if test -z "${ver}"; then
    ver="$(grep "Version:" <<< "$(apt-cache show ${name})" | awk '{print $2}')"
  fi
  echo "${name}" "${ver}"
}

function log { echo "$(date +%H:%M:%S)" "${@}"; }
function log_err { >&2 echo "$(date +%H:%M:%S)" "${@}"; }

function log_empty_line { echo ""; }

# Writes the manifest to a specified file.
function write_manifest {
  log "Writing ${1} packages manifest to ${3}..."  
  # 0:-1 to remove trailing comma, delimit by newline and sort.
  echo "${2:0:-1}" | tr ',' '\n' | sort > ${3}
  log "done"
}
