#!/bin/bash

# Don't fail on error. We use the exit status as a conditional.
#
# This is the default behavior but can be overridden by the caller in the 
# SHELLOPTS env var.
set +e

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
  local packages
  packages=$(echo "${1}" \
    | sed 's/[,\]/ /g; s/\s\+/ /g; s/^\s\+//g; s/\s\+$//g' \
    | sort -t' ')
  local script_dir
  script_dir="$(dirname -- "$(realpath -- "${0}")")"

  local architecture
  architecture=$(dpkg --print-architecture)
  local result

  # IMPORTANT: we rely on a list style input to the apt_query binary with ${packages}, do remove this lint disable!
  if [ "${architecture}" == "arm64" ]; then
    # shellcheck disable=SC2086
    result=$("${script_dir}/apt_query-arm64" normalized-list ${packages} 2>&1)
  else
    # shellcheck disable=SC2086
    result=$("${script_dir}/apt_query-x86" normalized-list ${packages} 2>&1)
  fi
  
  # Check if the command failed or if output looks like an error message
  if [ -z "${result}" ] || echo "${result}" | grep -qiE "^exit status|^error|^fatal|^unable"; then
    echo "apt_query failed" >&2
    echo "Output: ${result}" >&2
    # Return empty string to indicate failure
    echo ""
    return 1
  fi
    
  # WORKAROUND: Remove "Reverse=Provides: " prefix from strings if present, 
  # the go binary can return this prefix sometimes and it messes a bunch of things up.
  local clean_result
  clean_result="${result//Reverse=Provides: /}"
  
  if [[ "${-}" == *x* ]] || [ "${DEBUG:-${debug}}" = "true" ]; then
    echo "packages after sed: '${packages}'" >&2
    echo "original apt-query result: '${result}'" >&2
    echo "cleaned apt-query result: '${clean_result}'" >&2
  fi
  
  echo "${clean_result}"
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

function log { echo "${@}"; }
function log_err { >&2 echo "${@}"; }

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
# Deduplicates a space-delimited list of packages.
# Arguments:
#   Space delimited list of packages.
# Returns:
#   Space delimited list of unique packages (sorted).
###############################################################################
function deduplicate_packages {
  local packages="${1}"
  if test -z "${packages}"; then
    echo ""
    return
  fi
  
  # Convert space-separated to newline-separated, sort unique, then convert back to space-separated
  echo "${packages}" | tr ' ' '\n' | sort -u | tr '\n' ' ' | sed 's/[[:space:]]*$//'
}

###############################################################################
# Parses an Aptfile and extracts package names.
# Arguments:
#   File path to the Aptfile.
# Returns:
#   Space delimited list of package names (comments and empty lines removed).
###############################################################################
function parse_aptfile {
  local aptfile_path="${1}"
  if test ! -f "${aptfile_path}"; then
    echo ""
    return
  fi

  # Remove lines starting with #, remove inline comments (everything after #),
  # trim whitespace, remove empty lines, and join with spaces
  grep -v '^[[:space:]]*#' "${aptfile_path}" \
    | sed 's/#.*$//' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
    | grep -v '^$' \
    | tr '\n' ' ' \
    | sed 's/[[:space:]]\+/ /g' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
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
    # Create empty file to ensure outputs are always set
    touch "${3}"
  else
    log "Writing ${1} packages manifest to ${3}..."
    # Remove trailing comma if present, delimit by newline and sort.
    local content="${2}"
    if [ ${#content} -gt 0 ] && [ "${content: -1}" = "," ]; then
      content="${content:0:-1}"
    fi
    echo "${content}" | tr ',' '\n' | sort > "${3}"
    log "done"
  fi
}
