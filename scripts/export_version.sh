#!/bin/bash

#==============================================================================
# export_version.sh
#==============================================================================
#
# DESCRIPTION:
#   Script to export Go library version information for package development.
#   Extracts and exports version information from go.mod including Go version,
#   toolchain version, and syspkg version.
#
# USAGE:
#   export_version.sh [OPTIONS]
#
# OPTIONS:
#   -v, --verbose   Enable verbose output
#   -h, --help      Show this help message
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"
parse_common_args "$@" >/dev/null # prevent return from echo'ng

# Function to extract Go version from go.mod
get_go_version() {
  local go_version
  go_version=$(grep "^go " "${PROJECT_ROOT}/go.mod" | awk '{print $2}')
  log_debug "Extracted Go version: ${go_version}"
  echo "${go_version}"
}

# Function to extract toolchain version from go.mod
get_toolchain_version() {
  local toolchain_version
  toolchain_version=$(grep "^toolchain " "${PROJECT_ROOT}/go.mod" | awk '{print $2}')
  log_debug "Extracted toolchain version: ${toolchain_version}"
  echo "${toolchain_version}"
}

# Function to extract syspkg version from go.mod
get_syspkg_version() {
  local syspkg_version
  syspkg_version=$(grep "github.com/awalsh128/syspkg" "${PROJECT_ROOT}/go.mod" | awk '{print $2}')
  log_debug "Extracted syspkg version: ${syspkg_version}"
  echo "${syspkg_version}"
}

# Export versions as environment variables
log_info "Exporting version information..."
GO_VERSION=$(get_go_version)
export GO_VERSION
TOOLCHAIN_VERSION=$(get_toolchain_version)
export TOOLCHAIN_VERSION
SYSPKG_VERSION=$(get_syspkg_version)
export SYSPKG_VERSION

# Create a version info file
VERSION_FILE="${PROJECT_ROOT}/.version-info"
log_debug "Creating version file: ${VERSION_FILE}"
cat >"${VERSION_FILE}" <<EOF
# Version information for cache-apt-pkgs-action
GO_VERSION=${GO_VERSION}
TOOLCHAIN_VERSION=${TOOLCHAIN_VERSION}
SYSPKG_VERSION=${SYSPKG_VERSION}
EXPORT_DATE=$(date '+%Y-%m-%d %H:%M:%S')
EOF

echo "Version information has been exported to ${VERSION_FILE}"
echo "Go Version: ${GO_VERSION}"
echo "Toolchain Version: ${TOOLCHAIN_VERSION}"
echo "Syspkg Version: ${SYSPKG_VERSION}"

# Also create a JSON format for tools that prefer it
VERSION_JSON="${PROJECT_ROOT}/.version-info.json"
cat >"${VERSION_JSON}" <<EOF
{
    "goVersion": "${GO_VERSION}",
    "toolchainVersion": "${TOOLCHAIN_VERSION}",
    "syspkgVersion": "${SYSPKG_VERSION}",
    "exportDate": "$(date '+%Y-%m-%d %H:%M:%S')"
}
EOF

echo "Version information also exported in JSON format to ${VERSION_JSON}"
