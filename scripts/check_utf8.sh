#!/bin/bash

#==============================================================================
# check_utf8.sh
#==============================================================================
# 
# DESCRIPTION:
#   Script to check and validate UTF-8 encoding in text files.
#   Identifies files that are not properly UTF-8 encoded and reports them.
#   Skips binary files and common non-text file types.
#
# USAGE:
#   ./scripts/check_utf8.sh [<file>...] [directory]
#
# OPTIONS:
#   <file>      One or more files to check
#   <directory> A directory to scan for files
#
# DEPENDENCIES:
#   - bash
#   - file (for file type detection)
#   - iconv (for encoding detection)
#==============================================================================

# Required tools
command -v file >/dev/null 2>&1 || {
	echo "file command not found. Please install it."
	exit 1
}
command -v iconv >/dev/null 2>&1 || {
	echo "iconv command not found. Please install it."
	exit 1
}

# Find all potential text files, excluding certain directories and files
find . -type f \
	! -path "./.git/*" \
	! -name "*.png" \
	! -name "*.jpg" \
	! -name "*.jpeg" \
	! -name "*.gif" \
	! -name "*.ico" \
	! -name "*.bin" \
	! -name "*.exe" \
	! -name "*.dll" \
	! -name "*.so" \
	! -name "*.dylib" \
	-exec file -i {} \; |
	while read -r line; do
		file_path=$(echo "$line" | cut -d: -f1)
		mime_type=$(echo "$line" | cut -d: -f2)

		# Skip non-text files
		if [[ ! $mime_type =~ "text/" ]] && \
       [[ ! $mime_type =~ "application/json" ]] && \
       [[ ! $mime_type =~ "application/x-yaml" ]] && \
       [[ $line == *"binary"* ]]; then
			echo "⏭️  Skipping non-text file: $file_path ($mime_type)"
			continue
		fi

		encoding=$(echo "$mime_type" | grep -oP "charset=\K[^ ]*" || echo "unknown")

		# Skip if already UTF-8 or ASCII
		if [[ $encoding == "utf-8" ]] || [[ $encoding == "us-ascii" ]]; then
			echo "✓ $file_path is already UTF-8"
			continue
		fi

		echo "⚠️ Converting $file_path from $encoding to UTF-8"

		# Create a temporary file for conversion
		temp_file="${file_path}.tmp"

		# Try to convert the file to UTF-8
		if iconv -f "${encoding:-ISO-8859-1}" -t UTF-8 "$file_path" >"$temp_file" 2>/dev/null; then
			mv "$temp_file" "$file_path"
			echo "✓ Successfully converted $file_path to UTF-8"
		else
			rm -f "$temp_file"
			echo "⚠️ File $file_path appears to be binary or already UTF-8"
		fi
	done
