#!/bin/bash

#==============================================================================
# distribute.sh
#==============================================================================
#
# DESCRIPTION:
#   Build, package, and verify cache-apt-pkgs-action release artifacts for all
#   supported architectures. This includes version generation, apt-fast
#   cloning, binary building, checksum generation, and artifact reorganization.
#
# USAGE:
#   distribute.sh <command> [args]
#
# COMMANDS:
#   generate-version             Output version and commit info
#   create-distribute-directory  Create output directory for architecture
#   clone-apt-fast               Clone apt-fast repository
#   build-binary                 Build binary for GOOS/GOARCH/GOARM
#   generate-checksums           Generate checksums for binaries
#   verify-build                 Verify build output for architecture
#   reorganize-artifacts         Reorganize build artifacts
#
# OPTIONS:
#   -h, --help                   Show this help message
#==============================================================================

set -eEuo pipefail

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"

log_info "Using shared library functions for enhanced logging and utilities."

# Generate version from commit SHA
function generate_version() {
	local commit_sha="${GITHUB_SHA:0:8}"
	local version="${VERSION_PREFIX}-${commit_sha}"
	echo "version=${version}"
	echo "commit_sha=${commit_sha}"
	echo "full_sha=${GITHUB_SHA}"
}

# Create distribute directory
function create_distribute_directory() {
	local arch="$1"
	mkdir -p "distribute/${arch}"
}

# Clone apt-fast repository https://github.com/ilikenwf/apt-fast
function clone_apt_fast() {
	mkdir -p distribute/apt-fast
	git clone https://github.com/ilikenwf/apt-fast.git temp-apt-fast
	pushd temp-apt-fast
	git checkout 607f8ca5be31f5c45ebd5f6a47f724a07e49894b # v1.11.0
	local checksum
	checksum=$(sha256sum apt-fast | awk '{print $1}')
	log_info "Checksum: ${checksum}"
	cp -r ./* ../distribute/apt-fast/
	popd
	rm -rf temp-apt-fast
}

# Build binary for specific GOOS and GOARCH
function build_binary() {
	local goos="$1"
	local goarch="$2"
	local goarm="$3"
	local arch="$4"

	export GOOS="${goos}"
	export GOARCH="${goarch}"
	export GOARM="${goarm}"
	export CGO_ENABLED=0

	local binary_name="cache_apt_pkgs"
	if [[ ${goos} == "windows" ]]; then
		binary_name="${binary_name}.exe"
	fi

	local build_flags="-ldflags=-s -w -X main.version=${version} -X main.commit=${full_sha}"

	go build "${build_flags}" -o "distribute/${arch}/${binary_name}" ./cmd/cache_apt_pkgs

	# Make executable (no-op on Windows but harmless)
	chmod +x "distribute/${arch}/${binary_name}"
}

# Generate checksums for binaries
function generate_checksums() {
	local arch="$1"
	pushd "distribute/${arch}"
	for file in *; do
		if [[ -f ${file} ]] && [[ ${file} != *.sha256 ]]; then
			sha256sum "${file}" | awk '{print $1}' >"${file}.sha256"
			log_info "Generated checksum for ${file}"
		fi
	done
	popd
}

# Verify build output
function verify_build() {
	local arch="$1"
	ls -la "distribute/${arch}/"
	if [[ -f "distribute/${arch}/cache_apt_pkgs" ]]; then
		log_info "Binary built successfully"
		file "distribute/${arch}/cache_apt_pkgs"
	else
		log_error "Binary not found!"
		exit 1
	fi
}

# Reorganize artifacts
function reorganize_artifacts() {
	mkdir -p distribute
	for arch_dir in distribute-artifacts/cache-apt-pkgs-*; do
		if [[ -d ${arch_dir} ]]; then
			local arch_name
			arch_name=$(basename "${arch_dir}" | sed 's/cache-apt-pkgs-\(.*\)-[a-f0-9]*/\1/')
			cp -r "${arch_dir}"/* "distribute/${arch_name}/" 2>/dev/null || mkdir -p "distribute/${arch_name}"
			cp "${arch_dir}"/* "distribute/${arch_name}/" 2>/dev/null || true
		fi
	done

	log_info "Final distribute structure:"
	find distribute -type f -exec ls -la {} \;
}

# Main script logic
case "$1" in
generate-version)
	generate_version
	;;
create-distribute-directory)
	create_distribute_directory "$2"
	;;
clone-apt-fast)
	clone_apt_fast
	;;
build-binary)
	build_binary "$2" "$3" "$4" "$5"
	;;
generate-checksums)
	generate_checksums "$2"
	;;
verify-build)
	verify_build "$2"
	;;
reorganize-artifacts)
	reorganize_artifacts
	;;
*)
	log_error "Unknown command: $1"
	exit 1
	;;
esac
