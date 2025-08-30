#!/bin/bash

# Script to export Go library version information for package development
# This script reads version information from go.mod and exports it

set -e

# Get the directory containing this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to extract Go version from go.mod
get_go_version() {
    local go_version
    go_version=$(grep "^go " "$PROJECT_ROOT/go.mod" | awk '{print $2}')
    echo "$go_version"
}

# Function to extract toolchain version from go.mod
get_toolchain_version() {
    local toolchain_version
    toolchain_version=$(grep "^toolchain " "$PROJECT_ROOT/go.mod" | awk '{print $2}')
    echo "$toolchain_version"
}

# Function to extract syspkg version from go.mod
get_syspkg_version() {
    local syspkg_version
    syspkg_version=$(grep "github.com/awalsh128/syspkg" "$PROJECT_ROOT/go.mod" | awk '{print $2}')
    echo "$syspkg_version"
}

# Main execution
echo "Exporting version information..."
GO_VERSION=$(get_go_version)
TOOLCHAIN_VERSION=$(get_toolchain_version)
SYSPKG_VERSION=$(get_syspkg_version)

# Export versions as environment variables
export GO_VERSION
export TOOLCHAIN_VERSION
export SYSPKG_VERSION

# Create a version info file
VERSION_FILE="$PROJECT_ROOT/.version-info"
cat > "$VERSION_FILE" << EOF
# Version information for cache-apt-pkgs-action
GO_VERSION=$GO_VERSION
TOOLCHAIN_VERSION=$TOOLCHAIN_VERSION
SYSPKG_VERSION=$SYSPKG_VERSION
EXPORT_DATE=$(date '+%Y-%m-%d %H:%M:%S')
EOF

echo "Version information has been exported to $VERSION_FILE"
echo "Go Version: $GO_VERSION"
echo "Toolchain Version: $TOOLCHAIN_VERSION"
echo "Syspkg Version: $SYSPKG_VERSION"

# Also create a JSON format for tools that prefer it
VERSION_JSON="$PROJECT_ROOT/.version-info.json"
cat > "$VERSION_JSON" << EOF
{
    "goVersion": "$GO_VERSION",
    "toolchainVersion": "$TOOLCHAIN_VERSION",
    "syspkgVersion": "$SYSPKG_VERSION",
    "exportDate": "$(date '+%Y-%m-%d %H:%M:%S')"
}
EOF

echo "Version information also exported in JSON format to $VERSION_JSON"
