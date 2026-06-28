#!/bin/bash

LIB_EXIT_CODE=99

#######################################
# Clone a repository and change directory to it.
# Arguments:
#   The repository name.
#   The directory containing repository to rebase.
#   The tag to clone from, otherwise use HEAD.
# Returns:
#   0 if directory was changed, non-zero on error.
#######################################
function clone_repo {
  repo_name="${1}"
  repo_url="https://github.com/awalsh128/${repo_name}"
  repo_dir="${2}"
  repo_dir_parent=$(realpath "$(dirname "${repo_dir}")")
  wd=$(pwd)
  [[ -d ${repo_dir} ]] && rm -fr "${repo_dir}"
  cd "${repo_dir_parent}" || exit "${LIB_EXIT_CODE}"
  if [[ -n "${3}" ]]; then
    git clone -b "${3}" "${repo_url}"
  else
    git clone "${repo_url}"
  fi
  cd "${wd}" || exit "${LIB_EXIT_CODE}"
}

#######################################
# Clone a repository and change directory to it.
# Arguments:
#   The repository name.
#   The tag to clone from, otherwise use HEAD.
# Returns:
#   0 if directory was changed, non-zero on error.
#######################################
function clone_repo_and_cd {
  clone_repo "${1}" "/tmp/${1}" "${2}"
  cd "/tmp/${1}" || exit "${LIB_EXIT_CODE}"
}

#######################################
# Yes or no prompt.
# Arguments:
#   Message to display at prompt.
# Returns:
#   None
#######################################
function confirm_prompt {
  while true; do
    read -rp "${1} [Y|n] " response
    case ${response} in
      [Yy]*) break;;
      [Nn]*) exit;;
      *) echo "Invalid option selected.";;
    esac
  done
}

#######################################
# Validate argument and exit if invalid.
# Arguments:
#   Argument to validate.
#   Message to display on error.
#   Help message.
# Returns:
#   None
#######################################
function validate_arg {
  if [[ -n "${1}" ]] || [[ -z "${1}" ]]; then
    printf "error: %s\n%s\n" "${2}" "${3}"    
    exit 1
  fi
}

#######################################
# Print out command usage.
# Arguments:
#   Name of command.
#   Parameters
# Returns:
#   Usage message.
#######################################
function usage {
  echo "usage: $(basename "${1}") ${2}"
}