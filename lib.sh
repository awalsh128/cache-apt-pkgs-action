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
      dep_packages="${dep_packages}${BASH_REMATCH[1]}${BASH_REMATCH[2]}=${BASH_REMATCH[4]} "
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
    ${script_dir}/apt_query-arm64 normalized-list ${packages}
  else
    ${script_dir}/apt_query-x86 normalized-list ${packages}
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

###############################################################################
# Injects signed-by into a deb line if not already present.
# Arguments:
#   The deb line to process.
#   The keyring filepath to reference.
# Returns:
#   The deb line with signed-by injected.
###############################################################################
function inject_signed_by {
  local line="${1}"
  local keyring="${2}"

  # Already has signed-by, return unchanged.
  if echo "${line}" | grep -q 'signed-by='; then
    echo "${line}"
    return
  fi

  # Match deb or deb-src lines with existing options bracket.
  # e.g. "deb [arch=amd64] https://..." -> "deb [arch=amd64 signed-by=...] https://..."
  if echo "${line}" | grep -qE '^deb(-src)?\s+\['; then
    echo "${line}" | sed -E "s|^(deb(-src)?)\s+\[([^]]*)\]|\1 [\3 signed-by=${keyring}]|"
    return
  fi

  # Match deb or deb-src lines without options bracket.
  # e.g. "deb https://..." -> "deb [signed-by=...] https://..."
  if echo "${line}" | grep -qE '^deb(-src)?\s+'; then
    echo "${line}" | sed -E "s|^(deb(-src)?)\s+|\1 [signed-by=${keyring}] |"
    return
  fi

  # Not a deb line, return unchanged.
  echo "${line}"
}

###############################################################################
# Injects Signed-By into deb822-format (.sources) content if not already
# present. deb822 uses multi-line key-value blocks separated by blank lines.
# Arguments:
#   The full deb822 content string.
#   The keyring filepath to reference.
# Returns:
#   The content with Signed-By injected into each block that lacks it.
###############################################################################
function inject_signed_by_deb822 {
  local content="${1}"
  local keyring="${2}"

  # If Signed-By already present anywhere, return unchanged.
  if echo "${content}" | grep -qi '^Signed-By:'; then
    echo "${content}"
    return
  fi

  # Insert Signed-By after the Types: line in each block.
  echo "${content}" | sed "/^Types:/a\\
Signed-By: ${keyring}
"
}

###############################################################################
# Detects whether content is in deb822 format (.sources) or traditional
# one-line format (.list).
# Arguments:
#   The source file content.
# Returns:
#   Exit code 0 if deb822, 1 if traditional.
###############################################################################
function is_deb822_format {
  echo "${1}" | grep -qE '^Types:\s+'
}

###############################################################################
# Derives a keyring name from a URL.
# Arguments:
#   URL to derive name from.
# Returns:
#   A sanitized name suitable for a keyring filename (without extension).
###############################################################################
function derive_keyring_name {
  local url="${1}"
  # Use full URL (minus scheme) with non-alphanumeric chars replaced by hyphens.
  # This avoids collisions when two keys share a domain but differ in path.
  echo "${url}" | sed -E 's|https?://||; s|[/.]+|-|g; s|-+$||'
}

###############################################################################
# Extracts the repo URL from a deb line, stripping the deb prefix and options.
# Arguments:
#   A deb or deb-src line.
# Returns:
#   The repo URL (first URL after stripping prefix and options bracket).
###############################################################################
function extract_repo_url {
  echo "${1}" | sed -E 's/^deb(-src)?[[:space:]]+(\[[^]]*\][[:space:]]+)?//' | awk '{print $1}'
}

###############################################################################
# Removes existing apt source files that reference the same repo URL.
# This prevents "Conflicting values set for option Signed-By" errors when
# the runner already has a source configured (e.g., NVIDIA CUDA repo on
# GPU runners) and we add a new source with a different keyring path.
# Arguments:
#   The repo URL to check for conflicts.
#   The file path we're about to write (excluded from removal).
###############################################################################
function remove_conflicting_sources {
  local repo_url="${1}"
  local our_list_path="${2}"

  # Nothing to check if repo_url is empty.
  if [ -z "${repo_url}" ]; then
    return
  fi

  for src_file in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
    # Skip if glob didn't match any files.
    test -f "${src_file}" || continue
    # Skip our own file.
    test "${src_file}" = "${our_list_path}" && continue
    # Check if this file references the same repo URL (fixed-string match).
    if grep -qF "${repo_url}" "${src_file}" 2>/dev/null; then
      log "  Removing conflicting source: ${src_file}"
      sudo rm -f "${src_file}"
    fi
  done
}

###############################################################################
# Sets up GPG-signed third-party apt sources.
# Arguments:
#   Multi-line string where each line is: key_url | source_spec
# Returns:
#   Log lines from setup.
###############################################################################
function setup_apt_sources {
  local apt_sources="${1}"

  if [ -z "${apt_sources}" ]; then
    return
  fi

  log "Setting up GPG-signed apt sources..."

  while IFS= read -r line; do
    # Skip empty lines.
    if [ -z "$(echo "${line}" | tr -d '[:space:]')" ]; then
      continue
    fi

    # Split on pipe separator, trim whitespace with sed instead of xargs.
    local key_url=$(echo "${line}" | cut -d'|' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    local source_spec=$(echo "${line}" | cut -d'|' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    if [ -z "${key_url}" ] || [ -z "${source_spec}" ]; then
      log_err "Invalid apt-sources line (missing key_url or source_spec): ${line}"
      exit 7
    fi

    local keyring_name=$(derive_keyring_name "${key_url}")
    local keyring_path="/usr/share/keyrings/${keyring_name}.gpg"

    # Download GPG key to temp file, then detect format and convert if needed.
    log "- Downloading GPG key from ${key_url}..."
    local tmpkey=$(mktemp)
    if ! curl -fsSL "${key_url}" -o "${tmpkey}"; then
      log_err "Failed to download GPG key from ${key_url}"
      rm -f "${tmpkey}"
      exit 7
    fi

    # Detect if key is ASCII-armored or already binary.
    # "PGP public key block" = ASCII-armored, needs dearmoring.
    # "PGP/GPG key public ring" or other = already binary, copy directly.
    if file "${tmpkey}" | grep -qi 'PGP public key block$'; then
      # ASCII-armored key, dearmor it.
      if ! sudo gpg --batch --yes --dearmor -o "${keyring_path}" < "${tmpkey}"; then
        log_err "Failed to dearmor GPG key from ${key_url}"
        rm -f "${tmpkey}"
        exit 7
      fi
    else
      # Already in binary format, copy directly.
      sudo cp "${tmpkey}" "${keyring_path}"
    fi
    rm -f "${tmpkey}"
    log "  Keyring saved to ${keyring_path}"

    # Determine if source_spec is a URL (download source file) or inline deb line.
    if echo "${source_spec}" | grep -qE '^https?://'; then
      # Source spec is a URL to a source file - download it.
      local list_name="${keyring_name}"
      log "- Downloading source list from ${source_spec}..."
      local list_content
      if ! list_content=$(curl -fsSL "${source_spec}"); then
        log_err "Failed to download source list from ${source_spec}"
        exit 7
      fi

      if is_deb822_format "${list_content}"; then
        # deb822 format (.sources file) - inject Signed-By as a field.
        local list_path="/etc/apt/sources.list.d/${list_name}.sources"
        # Remove any existing source files that reference the same repo URLs
        # to prevent signed-by conflicts.
        local repo_urls=$(echo "${list_content}" | grep -i '^URIs:' | sed 's/^URIs:[[:space:]]*//')
        for url in ${repo_urls}; do
          remove_conflicting_sources "${url}" "${list_path}"
        done
        local processed_content=$(inject_signed_by_deb822 "${list_content}" "${keyring_path}")
        echo "${processed_content}" | sudo tee "${list_path}" > /dev/null
        log "  Source list (deb822) written to ${list_path}"
      else
        # Traditional one-line format (.list file) - inject signed-by per line.
        local list_path="/etc/apt/sources.list.d/${list_name}.list"
        # Remove conflicting sources for each deb line's repo URL.
        while IFS= read -r deb_line; do
          if echo "${deb_line}" | grep -qE '^deb(-src)?[[:space:]]+'; then
            local repo_url=$(extract_repo_url "${deb_line}")
            remove_conflicting_sources "${repo_url}" "${list_path}"
          fi
        done <<< "${list_content}"
        local processed_content=""
        while IFS= read -r deb_line; do
          if [ -n "${deb_line}" ]; then
            processed_content="${processed_content}$(inject_signed_by "${deb_line}" "${keyring_path}")
"
          fi
        done <<< "${list_content}"
        echo "${processed_content}" | sudo tee "${list_path}" > /dev/null
        log "  Source list written to ${list_path}"
      fi

    else
      # Source spec is an inline deb line.
      local list_name="${keyring_name}"
      local list_path="/etc/apt/sources.list.d/${list_name}.list"
      # Remove any existing source files that reference the same repo URL.
      local repo_url=$(extract_repo_url "${source_spec}")
      remove_conflicting_sources "${repo_url}" "${list_path}"
      local processed_line=$(inject_signed_by "${source_spec}" "${keyring_path}")
      echo "${processed_line}" | sudo tee "${list_path}" > /dev/null
      log "- Inline source written to ${list_path}"
    fi

  done <<< "${apt_sources}"

  log "done"
  log_empty_line
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
