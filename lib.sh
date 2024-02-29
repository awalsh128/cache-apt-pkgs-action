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
  local package_name=$(basename ${2} | awk -F\= '{print $1}')  
  local install_script_filepath=$(\
    get_install_script_filepath "${1}" "${package_name}" "${3}")
  if test ! -z "${install_script_filepath}"; then
    log "- Executing ${install_script_filepath}..."
    # Don't abort on errors; dpkg-trigger will error normally since it is
    # outside its run environment.
    sudo sh -x ${install_script_filepath} ${4} || true
    log "  done"
  fi
}

###############################################################################
# Gets the Debian install script filepath.
# Arguments:
#   Root directory to search from.
#   Name of the unqualified package to search for.
#   Extension of the installation script (preinst, postinst)
# Returns:
#   Filepath of the script file, otherwise an empty string.
###############################################################################
function get_install_script_filepath {
  # Filename includes arch (e.g. amd64).
  local filepath="$(\
    ls -1 ${1}var/lib/dpkg/info/${2}*.${3} 2> /dev/null \
    | grep -E ${2}'(:.*)?.'${3} | head -1 || true)"
  test "${filepath}" && echo "${filepath}"
}

###############################################################################
# Gets a list of installed packages from a Debian package installation log.
# Arguments:
#   The filepath of the Debian install log.
# Returns:
#   The list of colon delimited action syntax pairs with each pair equals
#   delimited. <name>:<version> <name>:<version>...
###############################################################################
function get_installed_packages {   
  local install_log_filepath="${1}"
  local regex="^Unpacking ([^ :]+)([^ ]+)? (\[[^ ]+\]\s)?\(([^ )]+)"  
  local dep_packages=""  
  while read -r line; do
    # ${regex} should be unquoted since it isn't a literal.
    if [[ "${line}" =~ ${regex} ]]; then
      dep_packages="${dep_packages}${BASH_REMATCH[1]}=${BASH_REMATCH[4]} "      
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
# Splits a fully action syntax APT package into the name and version.
# Arguments:
#   The action syntax equals delimited package pair or just the package name.
# Returns:
#   The package name and version pair.
###############################################################################
function get_package_name_ver {
  local ORIG_IFS="${IFS}"
  IFS=\= read name ver <<< "${1}"
  IFS="${ORIG_IFS}"
  # If version not found in the fully qualified package value.
  if test -z "${ver}"; then
    # This is a fallback and should not be used any more as its slow.
    log_err "Unexpected version resolution for package '${name}'"
    ver="$(apt-cache show ${name} | grep '^Version:' | awk '{print $2}')"
  fi
  echo "${name}" "${ver}"  
}

###############################################################################
# Sorts given packages by name and split on commas and/or spaces.
# Arguments:
#   The comma and/or space delimited list of packages.
# Returns:
#   Sorted list of space delimited package name=version pairs.
###############################################################################
function get_normalized_package_list {
  # Remove commas, and block scalar folded backslashes,
  # extraneous spaces at the middle, beginning and end
  # then sort.
  local packages=$(echo "${1}" \
    | sed 's/[,\]/ /g; s/\s\+/ /g; s/^\s\+//g; s/\s\+$//g' \
    | sort -t' ')
  local script_dir="$(dirname -- "$(realpath -- "${0}")")"

  local architecture=$(dpkg --print-architecture)
  if [ "${architecture}" == "arm64" ]; then
    ${script_dir}/apt_query_arm64 normalized-list ${packages}
  else
    ${script_dir}/apt_query normalized-list ${packages}
  fi
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

function log { echo "$(date +%T.%3N)" "${@}"; }
function log_err { >&2 echo "$(date +%T.%3N)" "${@}"; }

function log_empty_line { echo ""; }

###############################################################################
# Validates an argument to be of a boolean value.
# Arguments:
#   Argument to validate.
#   Variable name of the argument.
#   Exit code if validation fails.
# Returns:
#   Sorted list of space delimited packages.
###############################################################################
function validate_bool {
  if test "${1}" != "true" -a "${1}" != "false"; then
    log "aborted"
    log "${2} value '${1}' must be either true or false (case sensitive)."
    exit ${3}
  fi
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
