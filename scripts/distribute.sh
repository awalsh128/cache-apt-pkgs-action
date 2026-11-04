#!/bin/bash

# Script for building and distributing release artifacts.
# Used by the build-distribute.yml workflow.

set -e

COMMAND="${1}"
shift

# File recording the hash of the Go sources the committed apt_query binaries were built from.
SOURCE_HASH_FILE="apt_query.srchash"

###############################################################################
# Hash the Go sources that the apt_query binaries are built from. Tests and
# replay logs are excluded since they don't affect the binaries.
# Outputs:
#   SHA-256 hash of the sources.
###############################################################################
function get_source_hash {
  # Subshell so pipefail doesn't leak into the rest of the script.
  (
    set -o pipefail
    git ls-files -z --cached --others --exclude-standard -- \
        src go.mod go.sum ':!:*_test.go' ':!:**/testlogs/**' \
      | sort -z | xargs -0 --no-run-if-empty sha256sum | sha256sum | cut -d' ' -f1
  )
}

###############################################################################
# Build the apt_query binary.
# Arguments:
#   1: GOOS (e.g., linux).
#   2: GOARCH (e.g., amd64, arm64, arm, 386).
#   3: GOARM variant (e.g., "6" for armv6; empty string if not applicable).
#   4: Output file path.
###############################################################################
function build_apt_query {
  local goos="${1}"
  local goarch="${2}"
  local goarm="${3}"
  local output="${4}"
  echo "Building ${output} for ${goos}/${goarch} (variant: ${goarm:-none})..."
  GOOS="${goos}" GOARCH="${goarch}" GOARM="${goarm}" CGO_ENABLED=0 \
    go build -trimpath -o "${output}" ./src/cmd/apt_query
  chmod +x "${output}"
  echo "Binary built: ${output} ($(du -h "${output}" | cut -f1))"
}

case "${COMMAND}" in

  ###############################################################################
  # Generate a version string from the current commit SHA.
  # Outputs:
  #   commit_sha: First 8 characters of GITHUB_SHA.
  #   version: VERSION_PREFIX-commit_sha.
  ###############################################################################
  generate-version)
    # GITHUB_SHA, VERSION_PREFIX, and GITHUB_OUTPUT are set by the GitHub Actions runner.
    # shellcheck disable=SC2154
    COMMIT_SHA="${GITHUB_SHA:0:8}"
    # shellcheck disable=SC2154
    VERSION="${VERSION_PREFIX}-${COMMIT_SHA}"
    # shellcheck disable=SC2154
    echo "commit_sha=${COMMIT_SHA}" >> "${GITHUB_OUTPUT}"
    echo "version=${VERSION}" >> "${GITHUB_OUTPUT}"
    echo "Generated version: ${VERSION} (commit: ${COMMIT_SHA})"
    ;;

  ###############################################################################
  # Create the distribution directory for a given architecture and copy action
  # files into it.
  # Arguments:
  #   1: Architecture name (e.g., X64, ARM64, ARM, X86).
  ###############################################################################
  create-distribute-directory)
    ARCH="${1}"
    DIST_DIR="distribute/${ARCH}"
    mkdir -p "${DIST_DIR}"
    echo "Created distribution directory: ${DIST_DIR}"

    # Copy shell scripts and action definition.
    cp ./*.sh "${DIST_DIR}/"
    cp action.yml "${DIST_DIR}/"
    echo "Copied action files to ${DIST_DIR}"
    ;;

  ###############################################################################
  # Clone the apt-fast repository for bundling with the distribution.
  ###############################################################################
  clone-apt-fast)
    echo "Cloning apt-fast repository..."
    git clone --depth=1 https://github.com/ilikenwf/apt-fast.git apt-fast-repo
    echo "Cloned apt-fast repository to apt-fast-repo/"
    ;;

  ###############################################################################
  # Build the apt_query binary for a target architecture.
  # Arguments:
  #   1: GOOS (e.g., linux).
  #   2: GOARCH (e.g., amd64, arm64, arm, 386).
  #   3: GOARCH variant (e.g., "6" for armv6; empty string if not applicable).
  #   4: Architecture name (e.g., X64, ARM64, ARM, X86).
  ###############################################################################
  build-binary)
    GOOS="${1}"
    GOARCH="${2}"
    GOARCH_VARIANT="${3}"
    ARCH="${4}"

    ARCH_LOWER="$(echo "${ARCH}" | tr '[:upper:]' '[:lower:]')"
    DIST_DIR="distribute/${ARCH}"
    BINARY_NAME="apt_query-${ARCH_LOWER}"
    OUTPUT="${DIST_DIR}/${BINARY_NAME}"

    build_apt_query "${GOOS}" "${GOARCH}" "${GOARCH_VARIANT}" "${OUTPUT}"

    # Copy the apt-fast install script if available.
    if [[ -f "apt-fast-repo/apt-fast" ]]; then
      cp apt-fast-repo/apt-fast "${DIST_DIR}/"
      echo "Bundled apt-fast script in ${DIST_DIR}"
    fi
    ;;

  ###############################################################################
  # Generate SHA256 checksums for all files in the distribution directory.
  # Arguments:
  #   1: Architecture name (e.g., X64, ARM64, ARM, X86).
  ###############################################################################
  generate-checksums)
    ARCH="${1}"
    DIST_DIR="distribute/${ARCH}"
    CHECKSUM_FILE="${DIST_DIR}/checksums.txt"

    echo "Generating checksums for ${DIST_DIR}..."
    # Generate checksums for all files except the checksums file itself.
    (cd "${DIST_DIR}" && find . -maxdepth 1 -type f ! -name "checksums.txt" \
      -exec sha256sum {} + | sed 's|\./||' | sort > checksums.txt)
    echo "Checksums written to ${CHECKSUM_FILE}"
    cat "${CHECKSUM_FILE}"
    ;;

  ###############################################################################
  # Verify the build output for a given architecture.
  # Arguments:
  #   1: Architecture name (e.g., X64, ARM64, ARM, X86).
  ###############################################################################
  verify-build)
    ARCH="${1}"
    ARCH_LOWER="$(echo "${ARCH}" | tr '[:upper:]' '[:lower:]')"
    DIST_DIR="distribute/${ARCH}"
    BINARY_NAME="apt_query-${ARCH_LOWER}"
    OUTPUT="${DIST_DIR}/${BINARY_NAME}"

    if [[ ! -f "${OUTPUT}" ]]; then
      echo "Error: Binary not found: ${OUTPUT}" >&2
      exit 1
    fi

    echo "Verifying build: ${OUTPUT}"
    file "${OUTPUT}"

    # Verify it's an ELF executable.
    if ! file "${OUTPUT}" | grep -q "ELF"; then
      echo "Error: ${OUTPUT} is not a valid ELF executable" >&2
      exit 1
    fi

    echo "Build verified successfully: ${OUTPUT}"
    ;;

  ###############################################################################
  # Reorganize downloaded artifacts from distribute-artifacts/ into the
  # distribute/<arch>/ layout expected by the release step.
  # Artifact directories are named cache-apt-pkgs-<ARCH>-<commit_sha> and
  # are mapped to distribute/<arch_lowercase>/.
  ###############################################################################
  reorganize-artifacts)
    echo "Reorganizing artifacts..."
    # Use nullglob so the loop does not run if no directories match.
    shopt -s nullglob
    for artifact_dir in distribute-artifacts/cache-apt-pkgs-*/; do
      dir_name="$(basename "${artifact_dir}")"
      # Extract arch from the format "cache-apt-pkgs-<ARCH>-<8-char-commit-sha>".
      # The commit SHA is exactly 8 hex characters at the end.
      arch_upper="$(echo "${dir_name}" | sed 's/^cache-apt-pkgs-//; s/-[0-9a-f]\{8\}$//')"
      if [[ -z "${arch_upper}" ]]; then
        echo "Warning: Could not extract architecture from ${dir_name}, skipping" >&2
        continue
      fi
      arch_lower="$(echo "${arch_upper}" | tr '[:upper:]' '[:lower:]')"
      dest_dir="distribute/${arch_lower}"

      mkdir -p "${dest_dir}"
      cp -r "${artifact_dir}"* "${dest_dir}/"
      echo "Reorganized ${artifact_dir} -> ${dest_dir}"
    done
    shopt -u nullglob
    echo "Artifact reorganization complete"
    ;;

  ###############################################################################
  # Consolidate all per-architecture artifacts into a single flat
  # distribute/release/ directory for upload to GitHub Releases.
  # Common files (shell scripts, action.yml, apt-fast) are copied once from the
  # first available architecture directory. Architecture-specific binaries
  # (apt_query-*) are copied from every architecture directory. A combined
  # checksums.txt is generated at the end.
  ###############################################################################
  consolidate-release)
    RELEASE_DIR="distribute/release"
    ARCH_DIRS=(distribute/x64 distribute/arm64 distribute/arm distribute/x86)
    mkdir -p "${RELEASE_DIR}"
    echo "Consolidating release artifacts into ${RELEASE_DIR}..."

    # Find first available arch directory to source common files from.
    FIRST_ARCH_DIR=""
    for arch_dir in "${ARCH_DIRS[@]}"; do
      if [[ -d "${arch_dir}" ]]; then
        FIRST_ARCH_DIR="${arch_dir}"
        break
      fi
    done

    if [[ -z "${FIRST_ARCH_DIR}" ]]; then
      echo "Error: No architecture directories found under distribute/" >&2
      exit 1
    fi

    # Copy common files (everything except arch-specific binaries and checksums)
    # from the first arch directory.
    shopt -s nullglob
    for f in "${FIRST_ARCH_DIR}"/*; do
      filename="$(basename "${f}")"
      if [[ "${filename}" == apt_query-* ]] || [[ "${filename}" == checksums.txt ]]; then
        continue
      fi
      cp "${f}" "${RELEASE_DIR}/"
      echo "Copied common file: ${filename}"
    done
    shopt -u nullglob

    # Copy architecture-specific binaries from every arch directory.
    shopt -s nullglob
    for arch_dir in "${ARCH_DIRS[@]}"; do
      [[ -d "${arch_dir}" ]] || continue
      for binary in "${arch_dir}"/apt_query-*; do
        cp "${binary}" "${RELEASE_DIR}/"
        echo "Copied binary: $(basename "${binary}")"
      done
    done
    shopt -u nullglob

    # Generate a combined checksums file for all release assets.
    (cd "${RELEASE_DIR}" && find . -maxdepth 1 -type f ! -name "checksums.txt" \
      -exec sha256sum {} + | sed 's|\./||' | sort > checksums.txt)
    echo "Generated combined checksums:"
    cat "${RELEASE_DIR}/checksums.txt"

    echo "Consolidation complete. Release directory contents:"
    ls -la "${RELEASE_DIR}/"
    ;;

  ###############################################################################
  # Build the apt_query binaries committed at the repository root, which the
  # action runs directly, and record the hash of the sources they were built
  # from. Run this and commit the results whenever the Go sources change.
  ###############################################################################
  build-committed-binaries)
    for arch in x86:amd64 arm64:arm64; do
      build_apt_query linux "${arch#*:}" "" "apt_query-${arch%%:*}"
    done
    get_source_hash > "${SOURCE_HASH_FILE}"
    echo "Source hash written to ${SOURCE_HASH_FILE}"
    ;;

  ###############################################################################
  # Verify the committed apt_query binaries were built from the current Go
  # sources (regression issues #166, #218).
  ###############################################################################
  check-committed-binaries)
    EXPECTED="$(cat "${SOURCE_HASH_FILE}" 2>/dev/null || true)"
    ACTUAL="$(get_source_hash)"
    if [[ "${EXPECTED}" != "${ACTUAL}" ]]; then
      echo "Error: Committed apt_query binaries are out of date with the Go sources." >&2
      echo "Run './scripts/distribute.sh build-committed-binaries' and commit the results." >&2
      exit 1
    fi
    echo "Committed apt_query binaries match the Go sources."
    ;;

  *)
    echo "Error: Unknown command: ${COMMAND}" >&2
    echo "Usage: distribute.sh <command> [args...]" >&2
    echo "Commands:" >&2
    echo "  generate-version" >&2
    echo "  create-distribute-directory <arch>" >&2
    echo "  clone-apt-fast" >&2
    echo "  build-binary <goos> <goarch> <goarch_variant> <arch>" >&2
    echo "  generate-checksums <arch>" >&2
    echo "  verify-build <arch>" >&2
    echo "  reorganize-artifacts" >&2
    echo "  consolidate-release" >&2
    echo "  build-committed-binaries" >&2
    echo "  check-committed-binaries" >&2
    exit 1
    ;;

esac
