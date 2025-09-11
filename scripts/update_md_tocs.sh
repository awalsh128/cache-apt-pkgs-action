#!/bin/bash

#==============================================================================
# update_md_tocs.sh
#==============================================================================
#
# DESCRIPTION:
#   Automatically updates table of contents in all markdown files that contain
#   doctoc markers. The script handles installation of doctoc if not present
#   and applies consistent formatting across all markdown files.
#
# USAGE:
#   update_md_tocs.sh [OPTIONS]
#
# FEATURES:
#   - Auto-detects markdown files with doctoc markers
#   - Installs doctoc if not present (requires npm)
#   - Applies consistent settings across all files:
#     * Excludes document title
#     * Includes headers up to level 4
#     * Uses GitHub-compatible links
#   - Provides clear progress and error feedback
#
# TO ADD TOC TO A NEW FILE:
#   Add these markers to your markdown:
#   <!-- START doctoc generated TOC please keep comment here to allow auto update -->
#   <!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
#   <!-- doctoc --maxlevel 4 --no-title --notitle --github -->
#
#   <!-- END doctoc -->
#
# DEPENDENCIES:
#   - npm (for doctoc installation if needed)
#   - doctoc (will be installed if missing)
#
# EXIT CODES:
#   0 - Success
#   1 - Missing dependencies or installation failure
#
# NOTES:
#   - Only processes files containing doctoc markers
#   - Preserves existing markdown content
#   - Safe to run multiple times
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"

# Install doctoc if not present
if ! command_exists doctoc; then
  echo "doctoc not found. Installing..."
  if ! command_exists npm; then
    echo "Error: npm is required to install doctoc"
    exit 1
  fi

  if ! npm_package_installed doctoc; then
    echo "Installing doctoc globally..."
    if ! npm install -g doctoc; then
      fail "Failed to install doctoc"
    fi
  fi
fi

print_status "Updating table of contents in markdown files..."
# Find all markdown files that contain doctoc markers
find . -type f -name "*.md" -exec grep -l "START doctoc" {} \; | while read -r file; do
  log_info "Processing: ${file}"
  if ! doctoc --maxlevel 4 --no-title --notitle --github "${file}"; then
    log_error "Failed to update TOC in ${file}"
  fi
done

print_success "Table of contents update complete!"
