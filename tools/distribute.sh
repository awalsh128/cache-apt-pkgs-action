#!/bin/bash
set -e

CMD="$1"
RUNNER_ARCH="$2"
BUILD_DIR="../dist"

# GitHub runner.arch values to GOARCH values
# https://github.com/github/docs/blob/main/data/reusables/actions/runner-arch-description.md
# https://github.com/golang/go/blob/master/src/internal/syslist/syslist.go
declare -A rarch_to_goarch=(
	["X86"]="386"
	["X64"]="amd64"
	["ARM"]="arm"
	["ARM64"]="arm64"
)

function usage() {
	echo "error: $1" >&2
	echo -e "
Usage: $0 <command>
Commands:
  push - Build and push all architecture binaries to dist directory.
  getbinpath [X86, X64, ARM, ARM64] - Get the binary path from dist directory." >&2
	exit 1
}

function push() {
	rm -fr "$BUILD_DIR"
	mkdir -p "$BUILD_DIR"

	# Package name
	PACKAGE_NAME="cache-apt-pkgs"

	# Print the build plan
	echo "Building for these architectures:"
	for arch in "${!rarch_to_goarch[@]}"; do
		echo "  - Linux/$arch (GOARCH=${rarch_to_goarch[$arch]})"
	done
	echo

	# Build for each architecture
	local binary_name
	for runner_arch in "${!rarch_to_goarch[@]}"; do
		go_arch="${rarch_to_goarch[$runner_arch]}"
		binary_name="$BUILD_DIR/$PACKAGE_NAME-linux-$go_arch"

		echo "Building $binary_name for Linux/$runner_arch (GOARCH=$go_arch)..."

		# Build the binary
		GOOS=linux GOARCH=$go_arch go build -v \
			-o "$binary_name" \
			../src/cmd/cache_apt_pkgs

		echo "✓ Built $PACKAGE_NAME-linux-$go_arch"
	done

	echo "All builds completed!"
}

function getbinpath() {
	local runner_arch=$1

	if [[ -z $runner_arch ]]; then
		usage "runner architecture not provided"
	fi

	local go_arch="${rarch_to_goarch[$runner_arch]}"
	if [[ -z $go_arch ]]; then
		usage "invalid runner architecture: $runner_arch"
	fi

	local binary_name="$BUILD_DIR/cache-apt-pkgs-linux-$go_arch"
	if [[ ! -f $binary_name ]]; then
		usage "binary not found: $binary_name (did you run 'push' first?)"
	fi

	echo "$binary_name"
}

case $CMD in
push)
	push
	;;
getbinpath)
	getbinpath "$RUNNER_ARCH"
	;;
"")
	usage "command not provided"
	;;
*)
	usage "invalid command: $CMD"
	;;
esac
