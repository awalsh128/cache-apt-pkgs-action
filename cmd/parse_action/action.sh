#!/bin/bash

####################################################################################################
#
# Name: Cache APT Packages
# Description: Install APT based packages and cache them for future runs.
# Author: awalsh128
# 
# Branding:
#   Icon: hard-drive
#   Color: green
# 
# Inputs:
#   Packages:
#     Description: Space delimited list of packages to install. Version can be specified optionally using APT command syntax of <name>=<version> (e.g. xdot=1.2-2).
#     Required: true
#     Default: 
#   Version:
#     Description: Version of cache to load. Each version will have its own cache. Note, all characters except spaces are allowed.
#     Required: false
#     Default: 
#   Execute Install Scripts:
#     Description: Execute Debian package pre and post install script upon restore. See README.md caveats for more information.
#     Required: false
#     Default: false
#   Refresh:
#     Description: OBSOLETE: Refresh is not used by the action, use version instead.
#     Required: false
#     Default: 
#     Deprecation Message: Refresh is not used by the action, use version instead.
#   Debug:
#     Description: Enable debugging when there are issues with action. Minor performance penalty.
#     Required: false
#     Default: false
# 
# 
# Outputs:
#   Cache Hit:
#     Description: A boolean value to indicate a cache was found for the packages requested.
#     Value: ${{ steps.load-cache.outputs.cache-hit || false }}
#   Package Version List:
#     Description: The main requested packages and versions that are installed. Represented as a comma delimited list with equals delimit on the package version (i.e. <package>:<version,<package>:<version>).
#     Value: ${{ steps.post-cache.outputs.package-version-list }}
#   All Package Version List:
#     Description: All the pulled in packages and versions, including dependencies, that are installed. Represented as a comma delimited list with equals delimit on the package version (i.e. <package>:<version,<package>:<version>).
#     Value: ${{ steps.post-cache.outputs.all-package-version-list }}
# 
####################################################################################################

set -e

INPUTS_EXECUTE_INSTALL_SCRIPTS="false"
INPUTS_REFRESH="false"
INPUTS_DEBUG="false"
RUNNER_ARCH="X86_64"
GITHUB_ACTION_PATH="../../"
INPUTS_PACKAGES="xdot,rolldice"
INPUTS_VERSION="0"

#===================================================================================================
# Step ID: set-shared-env
#===================================================================================================

STEP_SET_SHARED_ENV_ENV_BINARY_PATH="${GITHUB_ACTION_PATH}/scripts/distribute.sh getbinpath ${RUNNER_ARCH}"
GH_ENV_ARCH="${RUNNER_ARCH}"
GH_ENV_BINARY_PATH="${BINARY_PATH}"
GH_ENV_CACHE_DIR="~/cache-apt-pkgs"
GH_ENV_DEBUG="${INPUTS_DEBUG}"
GH_ENV_GLOBAL_VERSION="20250910"
GH_ENV_PACKAGES="${INPUTS_PACKAGES}"
GH_ENV_VERSION="${INPUTS_VERSION}"


#===================================================================================================
# Step ID: install-aptfast
#===================================================================================================

if ! apt-fast --version > /dev/null 2>&1; then
  echo "Installing apt-fast for optimized installs and updates" &&
  /bin/bash -c "$(curl -sL https://raw.githubusercontent.com/ilikenwf/apt-fast/master/quick-install.sh)"
fi


#===================================================================================================
# Step ID: setup-binary
#===================================================================================================

if [[ ! -f "${BINARY_PATH}" ]]; then
  echo "Error: Binary not found at ${BINARY_PATH}"
  echo "Please ensure the action has been properly built and binaries are included in the distribute directory"
  exit 1
fi


#===================================================================================================
# Step ID: create-cache-key
#===================================================================================================

${BINARY_PATH} createkey \
  -os-arch "${ARCH}" \
  -plaintext-path "${CACHE_DIR}/cache_key.txt" \
  -ciphertext-path "${CACHE_DIR}/cache_key.md5" \
  -version "${VERSION}" \
  -global-version "${GLOBAL_VERSION}" \
  ${PACKAGES}
GH_OUTPUT_CREATE_CACHE_KEY_CACHE_KEY="$(cat ${CACHE_DIR}/cache_key.md5)"


#===================================================================================================
# Step ID: load-cache
#===================================================================================================

STEP_LOAD_CACHE_WITH_PATH="${{ env.CACHE_DIR }}"
STEP_LOAD_CACHE_WITH_KEY="cache-apt-pkgs_${{ steps.create-cache-key.outputs.cache-key }}"
if [[ -d "${cache-apt-pkgs_${{ steps.create-cache-key.outputs.cache-key }}}" ]]; then
  OUTPUT_CACHE_HIT=true
else
	OUTPUT_CACHE_HIT=false
	mkdir "${cache-apt-pkgs_${{ steps.create-cache-key.outputs.cache-key }}}"
fi

# NO HANDLER FOUND for actions/cache/restore@v4

#===================================================================================================
# Step ID: post-load-cache
#===================================================================================================

STEP_POST_LOAD_CACHE_ENV_CACHE_HIT="${{ steps.load-cache.outputs.cache-hit }}"
STEP_POST_LOAD_CACHE_ENV_EXEC_INSTALL_SCRIPTS="${INPUTS_EXECUTE_INSTALL_SCRIPTS}"
if [ "${CACHE_HIT}" == "true" ]; then
  ${BINARY_PATH} restore \
    -cache-dir "${CACHE_DIR}" \
    -restore-root "/" \
    "${PACKAGES}"
else
  ${BINARY_PATH} install \
    -cache-dir "${CACHE_DIR}" \
    -version "${VERSION}" \
    -global-version "${GLOBAL_VERSION}" \
    "${PACKAGES}"
fi
GH_OUTPUT_POST_LOAD_CACHE_PACKAGE_VERSION_LIST="\"$(cat "${CACHE_DIR}/pkgs_args.txt")\""
GH_OUTPUT_POST_LOAD_CACHE_ALL_PACKAGE_VERSION_LIST="\"$(cat "${CACHE_DIR}/pkgs_installed.txt")\""


#===================================================================================================
# Step ID: upload-artifacts
#===================================================================================================

# NO HANDLER FOUND for actions/upload-artifact@v4

#===================================================================================================
# Step ID: save-cache
#===================================================================================================

# NO HANDLER FOUND for actions/cache/save@v4

#===================================================================================================
# Step ID: clean-cache
#===================================================================================================

rm -rf ~/cache-apt-pkgs

