#!/bin/bash

#==============================================================================
# lib.sh - Core Shell Script Library
#==============================================================================
#
# DESCRIPTION:
#   Enhanced common shell script library providing core functionality for all
#   project scripts. Includes logging, error handling, argument parsing, file
#   operations, command validation, and workflow utilities.
#
# USAGE:
#   source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
#
# FUNCTIONS:
#   Logging:
#     log_info <msg>       Log informational message to stdout
#     log_warn <msg>       Log warning message to stderr
#     log_error <msg>      Log error message to stderr
#     log_success <msg>    Log success message to stdout
#     log_debug <msg>      Log debug message to stderr (if VERBOSE=true)
#     print_header <text>  Print formatted section header
#
#   Arguments:
#     parse_common_args    Process standard script arguments (-h, -v, -q)
#     show_help           Display script-specific help from header comments
#
#   UI Utilities:
#     echo_color <color> <msg>  Print message in specified color
#     confirm <prompt>         Prompt for yes/no confirmation
#     pause                   Wait for user input to continue
#
# DEPENDENCIES:
#   - bash 4.0+ (for associative arrays and other features)
#   - coreutils (tput, basename, readlink)
#
# ENVIRONMENT:
#   VERBOSE      Enable verbose debug logging (default: false)
#   QUIET       Suppress non-error output (default: false)
#   PS4         Debug prefix format when running with bash -x
#
# EXAMPLES:
#   source ./lib.sh
#   log_info "Starting process..."
#   parse_common_args "$@"
#   confirm "Continue?" || exit 1
#==============================================================================

# Enable strict error handling
set -eEuo pipefail

# Detect debugging flag (bash -x) and also print line numbers
[[ $- == *"x"* ]] && PS4='+$(basename ${BASH_SOURCE[0]}:${LINENO}): ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'

# Script configuration and runtime control
export VERBOSE=${VERBOSE:-false} # Enable verbose debug logging
export QUIET=${QUIET:-false}     # Suppress non-error output
export SCRIPT_DIRNAME="scripts"  # Standard scripts directory name

#==============================================================================
# ANSI Color and Text Formatting Codes
#==============================================================================
# These color codes are used by the echo_color and logging functions to provide
# consistent terminal output formatting across all scripts.

# Basic colors
export GREEN='\033[0;32m'   # Success, completion
export RED='\033[0;31m'     # Errors, failures
export YELLOW='\033[0;33m'  # Warnings, cautions
export BLUE='\033[0;34m'    # Information, headers
export CYAN='\033[0;36m'    # Processing status
export MAGENTA='\033[0;35m' # Special notifications

# Text formatting
export NC='\033[0m'    # Reset all formatting
export BOLD='\033[1m'  # Bold/bright text
export DIM='\033[2m'   # Dim/muted text
export BLINK='\033[5m' # Blinking text

# Print text in the specified color with proper formatting
# Arguments:
#   [-e|-n]     Optional echo flags (-e enable escapes, -n no newline)
#   color      Color name (green|red|yellow|blue|cyan|magenta)
#   message    Text to print in the specified color
# Example:
#   echo_color green "Operation successful!"
#   echo_color -n blue "Processing..."
function echo_color() {
	local echo_flags=()
	# Collect valid echo flags that start with dash
	while [[ $1 == -* ]]; do
		if [[ $1 == "-e" || $1 == "-n" ]]; then
			echo_flags+=("$1")
		fi
		shift
	done

	# Convert color name to uppercase variable name
	local color="$1"
	local color_var
	color_var=$(echo "${color}" | tr '[:lower:]' '[:upper:]')
	shift

	# Print message with color codes and any specified flags
	echo -e "${echo_flags[@]}" "${!color_var}$*${NC}"
}

#==============================================================================
# Logging and Output Functions
#==============================================================================
# A comprehensive set of logging functions that provide consistent formatting and
# behavior for different types of messages. All functions respect the QUIET and
# VERBOSE environment variables for controlled output.

# Log an informational message to stdout
# Arguments:
#   message    The information to log
# Respects: QUIET=true will suppress output
function log_info() {
	if ! ${QUIET}; then
		echo -e "${BLUE}[INFO]${NC} $1"
	fi
}

# Log a warning message to stderr
# Arguments:
#   message    The warning to log
# Notes: Not affected by QUIET mode
function log_warn() {
	echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

# Log an error message to stderr
# Arguments:
#   message    The error message to log
# Notes: Not affected by QUIET mode
function log_error() {
	echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Log a success message to stdout
# Arguments:
#   message    The success message to log
# Respects: QUIET=true will suppress output
function log_success() {
	if ! ${QUIET}; then
		echo -e "${GREEN}[SUCCESS]${NC} $1"
	fi
}

# Log a debug message to stderr if verbose mode is enabled
# Arguments:
#   message    The debug information to log
# Requires: VERBOSE=true to display output
function log_debug() {
	if ${VERBOSE}; then
		echo -e "${DIM}[DEBUG]${NC} $1" >&2
	fi
}

# Print a formatted section header with proper spacing
# Arguments:
#   text       The header text to display
# Respects: QUIET=true will suppress output
function print_header() {
	if ! ${QUIET}; then
		echo -en "\n${BOLD}${BLUE}$1${NC}\n"
	fi
}

#==============================================================================
# Command-line Argument Processing Functions
#==============================================================================
# These functions provide standardized argument parsing and help display across
# all scripts. They handle common flags (-h, -v, -q) and extract help text
# from script headers.

# Display formatted help text extracted from the calling script's header comments
# Usage:
#   show_help    # Called automatically by parse_common_args for -h flag
# Returns:
#   Prints formatted help text to stdout
# Notes:
#   - Extracts text between the first #=== block in the script header
#   - Removes comment markers (#) and formats for clean display
#   - Returns early with message if script file cannot be found
function show_help() {
	# Extract header comment block from calling script
	local script_file="${BASH_SOURCE[1]}"

	if [[ ! -f ${script_file} ]]; then
		echo "Help information not available"
		return
	fi

	# Process the header block and format output
	local lines=$'\n'
	local inside_header=false
	while IFS= read -r line; do
		if [[ ${inside_header} == true ]]; then
			[[ ${line} =~ ^#\=+ ]] && continue
			if [[ ${line} =~ ^# ]]; then
				lines+="${line#\#}"$'\n'
			else
				break
			fi
		fi
		[[ ${line} =~ ^#\=+ ]] && inside_header=true
	done <"${script_file}"
	printf "%s" "${lines}"
}

# Process common command-line arguments used across all scripts
# Arguments:
#   $@    All script arguments to process
# Options:
#   -h, --help     Show help text and exit
#   -v, --verbose  Enable verbose debug output
#   -q, --quiet    Suppress non-error output
# Returns:
#   Prints any unhandled arguments to stdout for capture by caller
#   Returns 0 on success
function parse_common_args() {
	while [[ $# -gt 0 ]]; do
		case $1 in
		-h | --help)
			[[ $(type -t show_help) == function ]] && show_help
			exit 0
			;;
		-v | --verbose)
			if [[ ${VERBOSE} == false ]]; then
				export VERBOSE=true
				log_debug "Verbose mode enabled"
			fi
			shift
			;;
		-q | --quiet)
			export QUIET=true
			shift
			;;
		*)
			# Stop at first non-flag argument
			break
			;;
		esac
	done

	# Return any unprocessed arguments to caller
	if [[ $# -gt 0 ]]; then
		echo "$@"
	fi
	return 0
}

#==============================================================================
# Interactive User Interface Functions
#==============================================================================
# These functions provide consistent user interaction patterns across scripts,
# including confirmation prompts and execution pauses. All respect the QUIET
# environment variable for automated execution.

# Pause script execution until user presses any key
# Usage:
#   pause    # Shows prompt and waits for keypress
# Notes:
#   - Automatically skipped if QUIET=true
#   - Adds newlines before and after prompt for clean formatting
function pause() {
	[[ ${QUIET} == true ]] && return
	echo
	read -n 1 -s -r -p "Press any key to continue..."
	echo
}

# Prompt user for yes/no confirmation
# Arguments:
#   prompt    Optional custom prompt (default: "Are you sure?")
# Usage:
#   confirm "Delete all files?" || exit 1
# Returns:
#   0 if user confirms (yes)
#   1 if user declines (no)
# Notes:
#   - Accepts y, yes, n, no (case insensitive)
#   - Repeats prompt until valid input received
function confirm() {
	local prompt="${1:-Are you sure?}"
	local response

	while true; do
		read -rp "${prompt} (y/n): " response
		case ${response} in
		[Yy] | [Yy][Ee][Ss]) return 0 ;;
		[Nn] | [Nn][Oo]) return 1 ;;
		*) echo "Please answer yes or no." ;;
		esac
	done
}
