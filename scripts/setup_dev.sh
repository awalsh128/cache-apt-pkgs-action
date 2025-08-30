#!/bin/bash

#==============================================================================
# setup_dev.sh
#==============================================================================
# 
# DESCRIPTION:
#   Sets up the development environment for the cache-apt-pkgs-action project.
#   Installs all necessary tools, configures Go environment, and sets up
#   pre-commit hooks.
#
# USAGE:
#   ./scripts/setup_dev.sh
#
# DEPENDENCIES:
#   - go
#   - npm
#   - git
#==============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if an npm package is installed globally
npm_package_installed() {
    npm list -g "$1" >/dev/null 2>&1
}

# Function to print status messages
print_status() {
    echo -e "${GREEN}==>${NC} $1"
}

# Function to print error messages
print_error() {
    echo -e "${RED}Error:${NC} $1"
    exit 1
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists go; then
    print_error "Go is not installed. Please install Go first."
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install Node.js and npm first."
fi

if ! command_exists git; then
    print_error "git is not installed. Please install git first."
fi

# Configure Go environment
print_status "Configuring Go environment..."
go env -w GO111MODULE=auto

# Verify Go modules
print_status "Verifying Go modules..."
go mod tidy
go mod verify

# Install development tools
print_status "Installing development tools..."

# Trunk for linting
if ! command_exists trunk; then
    print_status "Installing trunk..."
    curl -fsSL https://get.trunk.io -o get-trunk.sh
    bash get-trunk.sh
    rm get-trunk.sh
fi

# doctoc for markdown TOC
if ! npm_package_installed doctoc; then
    print_status "Installing doctoc..."
    npm install -g doctoc
fi

# Go tools
print_status "Installing Go tools..."
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/segmentio/golines@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Set up Git hooks
print_status "Setting up Git hooks..."
if [ -d .git ]; then
    # Initialize trunk
    trunk init

    # Enable pre-commit hooks
    git config core.hooksPath .git/hooks/
else
    print_error "Not a git repository"
fi

# Update markdown TOCs
print_status "Updating markdown TOCs..."
./scripts/update_md_tocs.sh

# Initial trunk check
print_status "Running initial trunk check..."
trunk check

# Final verification
print_status "Verifying installation..."
go test ./...

print_status "Development environment setup complete!"
echo "You can now:"
echo "  1. Run tests: go test ./..."
echo "  2. Run linting: trunk check"
echo "  3. Update markdown TOCs: ./scripts/update_md_tocs.sh"
