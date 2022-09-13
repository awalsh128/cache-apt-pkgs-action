#!/bin/bash

# Sort these packages by name and split on commas.
#######################################
# Sorts given packages by name and split on commas.
# Arguments:
#   The comma delimited list of packages.
# Returns:
#   Sorted list of space delimited packages.
#######################################
function normalize_package_list {
  local stripped=$(echo "${1}" | sed 's/,//g')
  # Remove extraneous spaces at the middle, beginning, and end.
  local trimmed="$(echo "${stripped}" | sed 's/\s\+/ /g; s/^\s\+//g; s/\s\+$//g')"
  local sorted="$(echo ${trimmed} | tr ' ' '\n' | sort | tr '\n' ' ')"
  echo "${sorted}"  
}

#######################################
# Gets a list of installed packages from a Debian package installation log.
# Arguments:
#   The filepath of the Debian install log.
# Returns:
#   The list of space delimited pairs with each pair colon delimited.
#   <name>:<version> <name:version>...
#######################################
function get_installed_packages {   
  install_log_filepath="${1}"
  local regex="^Unpacking ([^ :]+)([^ ]+)? (\[[^ ]+\]\s)?\(([^ )]+)"  
  dep_packages=""  
  while read -r line; do
    if [[ "${line}" =~ ${regex} ]]; then
      dep_packages="${dep_packages}${BASH_REMATCH[1]}:${BASH_REMATCH[4]} "      
    else
      log_err "Unable to parse package name and version from \"${line}\""
      exit 2
    fi
  done < <(grep "^Unpacking " ${install_log_filepath})
  if test -n "${dep_packages}"; then
    echo "${dep_packages:0:-1}"  # Removing trailing space.
  else
    echo ""
  fi
}

#######################################
# Splits a fully qualified package into name and version.
# Arguments:
#   The colon delimited package pair or just the package name.
# Returns:
#   The package name and version pair.
#######################################
function get_package_name_ver {
  IFS=\: read name ver <<< "${1}"
  # If version not found in the fully qualified package value.
  if test -z "${ver}"; then
    ver="$(grep "Version:" <<< "$(apt-cache show ${name})" | awk '{print $2}')"
  fi
  echo "${name}" "${ver}"
}

#######################################
# Gets the Debian postinst file location.
# Arguments:
#   Name of the unqualified package to search for.
# Returns:
#   Filepath of the postinst file, otherwise an empty string.
#######################################
function get_postinst_filepath {
  filepath="/var/lib/dpkg/info/${1}"
  if test -f "${filepath}"; then
    echo "${filepath}"
  else
    echo ""
  fi
}

function log { echo "$(date +%H:%M:%S)" "${@}"; }
function log_err { >&2 echo "$(date +%H:%M:%S)" "${@}"; }

function log_empty_line { echo ""; }

#######################################
# Writes the manifest to a specified file.
# Arguments:
#   Type of manifest being written.
#   List of packages being written to the file.
#   File path of the manifest being written.
# Returns:
#   Log lines from write.
#######################################
function write_manifest {  
  if [ ${#2} -eq 0 ]; then 
    log "Skipped ${1} manifest write. No packages to install."
  else
    log "Writing ${1} packages manifest to ${3}..."
    # 0:-1 to remove trailing comma, delimit by newline and sort.
    echo "${2:0:-1}" | tr ',' '\n' | sort > ${3}
    log "done"
  fi
}
