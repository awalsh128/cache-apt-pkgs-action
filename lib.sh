#!/bin/bash

###############################################################################
# Execute the Debian install script.
# Arguments:
#   Root directory to search from.
#   File path to cached package archive.
#   Installation script extension (preinst, postinst).
#   Parameter to pass to the installation script.
# Returns:
#   Filepath of the install script, otherwise an empty string.
###############################################################################
function execute_install_script {
  local package_name=$(basename ${2} | awk -F\: '{print $1}')  
  local install_script_filepath=$(\
    get_install_filepath "${1}" "${package_name}" "${3}")
  if test ! -z "${install_script_filepath}"; then
    log "- Executing ${install_script_filepath}..."
    # Don't abort on errors; dpkg-trigger will error normally since it is outside 
    # its run environment.
    sudo sh -x ${install_script_filepath} ${4} || true
    log "  done"
  fi
}

###############################################################################
# Gets a list of installed packages from a Debian package installation log.
# Arguments:
#   The filepath of the Debian install log.
# Returns:
#   The list of space delimited pairs with each pair colon delimited.
#   <name>:<version> <name:version>...
###############################################################################
function get_installed_packages {   
  local install_log_filepath="${1}"
  local regex="^Unpacking ([^ :]+)([^ ]+)? (\[[^ ]+\]\s)?\(([^ )]+)"  
  local dep_packages=""  
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

###############################################################################
# Splits a fully qualified package into name and version.
# Arguments:
#   The colon delimited package pair or just the package name.
# Returns:
#   The package name and version pair.
###############################################################################
function get_package_name_ver {
  IFS=\: read name ver <<< "${1}"
  # If version not found in the fully qualified package value.
  if test -z "${ver}"; then
    ver="$(grep "Version:" <<< "$(apt-cache show ${name})" | awk '{print $2}')"
  fi
  echo "${name}" "${ver}"
}

###############################################################################
# Gets the package name from the cached package filepath in the
# path/to/cache/dir/<name>:<version>.tar format.
# Arguments:
#   Filepath to the cached packaged.
# Returns:
#   The package name.
###############################################################################
function get_package_name_from_cached_filepath {
  basename ${cached_pkg_filepath} | awk -F\: '{print $1}'
}

###############################################################################
# Gets the Debian install script file location.
# Arguments:
#   Root directory to search from.
#   Name of the unqualified package to search for.
#   Extension of the installation script (preinst, postinst)
# Returns:
#   Filepath of the script file, otherwise an empty string.
###############################################################################
function get_install_filepath {
  # Filename includes arch (e.g. amd64).
  local filepath="$(\
    ls -1 ${1}var/lib/dpkg/info/${2}*.${3} \
    | grep -E ${2}'(:.*)?.'${3} | head -1)"
  test "${filepath}" && echo "${filepath}"
}

###############################################################################
# Gets the relative filepath acceptable by Tar. Just removes the leading slash
# that Tar disallows.
# Arguments:
#   Absolute filepath to archive.
# Returns:
#   The relative filepath to archive.
###############################################################################
function get_tar_relpath {
  local filepath=${1}
  if test ${filepath:0:1} = "/"; then
    echo "${filepath:1}"
  else
    echo "${filepath}"
  fi
}

function log { echo "$(date +%H:%M:%S)" "${@}"; }
function log_err { >&2 echo "$(date +%H:%M:%S)" "${@}"; }

function log_empty_line { echo ""; }

###############################################################################
# Sorts given packages by name and split on commas.
# Arguments:
#   The comma delimited list of packages.
# Returns:
#   Sorted list of space delimited packages.
###############################################################################
function normalize_package_list {
  local stripped=$(echo "${1}" | sed 's/,//g')
  # Remove extraneous spaces at the middle, beginning, and end.
  local trimmed="$(\
    echo "${stripped}" \
    | sed 's/\s\+/ /g; s/^\s\+//g; s/\s\+$//g')"
  local sorted="$(echo ${trimmed} | tr ' ' '\n' | sort | tr '\n' ' ')"
  echo "${sorted}"  
}

###############################################################################
# Writes the manifest to a specified file.
# Arguments:
#   Type of manifest being written.
#   List of packages being written to the file.
#   File path of the manifest being written.
# Returns:
#   Log lines from write.
###############################################################################
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
