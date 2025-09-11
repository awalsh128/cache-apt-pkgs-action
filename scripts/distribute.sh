#!/bin/bash

#==============================================================================
# distribute.sh
#==============================================================================
#
# DESCRIPTION:
#   Manages distribution of compiled binaries for different architectures.
#   Handles building, pushing, and retrieving binary paths for GitHub Actions.
#
# USAGE:
#   ./scripts/distribute.sh [OPTIONS] <command> [architecture]
#
# COMMANDS:
#   push              - Build and push all architecture binaries to dist directory
#   getbinpath [ARCH] - Get binary path for specified architecture
#
# ARCHITECTURES:
#   X86, X64, ARM, ARM64 - GitHub runner architectures
#
# OPTIONS:
#   -v, --verbose   Enable verbose output
#   -h, --help      Show this help message
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"
parse_common_args "$@" >/dev/null # prevent return from echo'ng

CMD="$1"
RUNNER_ARCH="$2"
BUILD_DIR="${PROJECT_ROOT}/dist"

# GitHub runner.arch values to GOARCH values
# https://github.com/github/docs/blob/main/data/reusables/actions/runner-arch-description.md
# https://github.com/golang/go/blob/master/src/internal/syslist/syslist.go
declare -A rarch_to_goarch=(
  ["X86"]="386"
  ["X64"]="amd64"
  ["ARM"]="arm"
  ["ARM64"]="arm64"
)

function push() {
  rm -fr "${BUILD_DIR}"
  mkdir -p "${BUILD_DIR}"

  # Package name
  PACKAGE_NAME="cache-apt-pkgs"

  # Print the build plan
  echo "Building for these architectures:"
  for arch in "${!rarch_to_goarch[@]}"; do
    echo "  - Linux/${arch} (GOARCH=${rarch_to_goarch[${arch}]})"
  done
  echo

  # Build for each architecture
  local binary_name
  for runner_arch in "${!rarch_to_goarch[@]}"; do
    go_arch="${rarch_to_goarch[${runner_arch}]}"
    binary_name="${BUILD_DIR}/${PACKAGE_NAME}-linux-${go_arch}"

    echo "Building ${binary_name} for Linux/${runner_arch} (GOARCH=${go_arch})..."

    # Build the binary
    GOOS=linux GOARCH=${go_arch} go build -v \
      -o "${binary_name}" \
      "${PROJECT_ROOT}/cmd/cache_apt_pkgs"

    echo "✓ Build ${PACKAGE_NAME}-linux-${go_arch}"
  done

  echo "All builds completed!"
}

function getbinpath() {
  local runner_arch=$1

  if [[ -z ${runner_arch} ]]; then
    fail "runner architecture not provided"
  fi

  local go_arch="${rarch_to_goarch[${runner_arch}]}"
  if [[ -z ${go_arch} ]]; then
    fail "invalid runner architecture: ${runner_arch}"
  fi

  local binary_name="${BUILD_DIR}/cache-apt-pkgs-linux-${go_arch}"
  if [[ ! -f ${binary_name} ]]; then
    fail "binary not found: ${binary_name} (did you run 'push' first?)"
  fi

  echo "${binary_name}"
}

case ${CMD} in
push)
  push
  ;;
getbinpath)
  getbinpath "${RUNNER_ARCH}"
  ;;
"")
  fail "command not provided"
  ;;
*)
  fail "invalid command: ${CMD}"
  ;;
esac
