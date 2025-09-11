#!/bin/bash

#==============================================================================
# lib.sh
#==============================================================================
#
# DESCRIPTION:
#   Enhanced common shell script library for project utilities and helpers.
#   Provides functions for logging, error handling, argument parsing, file operations,
#   command validation, and development workflow tasks.
#
# USAGE:
#   source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
#
# FEATURES:
#   - Consistent logging and output formatting
#   - Command existence and dependency checking
#   - File and directory operations
#   - Project structure helpers
#   - Development tool installation helpers
#   - Error handling and validation
#
#==============================================================================

# Exit on error by default for sourced scripts
set -eE -o functrace

# Detect debugging flag (bash -x) and also print line numbers
[[ $- == *"x"* ]] && PS4='+$(basename ${BASH_SOURCE[0]}:${LINENO}): ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'

# Global variables
export VERBOSE=${VERBOSE:-false}
export QUIET=${QUIET:-false}
export SCRIPT_DIRNAME="scripts"

#==============================================================================
# Logging Functions
#==============================================================================

export GREEN='\033[0;32m'
export RED='\033[0;31m'
export YELLOW='\033[0;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export MAGENTA='\033[0;35m'
export NC='\033[0m' # No Color
export BOLD='\033[1m'
export DIM='\033[2m'
export BLINK='\033[5m'

echo_color() {
  local echo_flags=()
  # Collect echo flags (start with -)
  while [[ $1 == -* ]]; do
    if [[ $1 == "-e" || $1 == "-n" ]]; then
      echo_flags+=("$1")
    fi
    shift
  done
  local color="$1"
  local color_var
  color_var=$(echo "${color}" | tr '[:lower:]' '[:upper:]')
  shift
  echo -e "${echo_flags[@]}" "${!color_var}$*${NC}"
}

#==============================================================================
# Logging Functions
#==============================================================================

log_info() {
  if ! ${QUIET}; then
    echo -e "${BLUE}[INFO]${NC} $1"
  fi
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
  if ! ${QUIET}; then
    echo -e "${GREEN}[SUCCESS]${NC} $1"
  fi
}

log_debug() {
  if ${VERBOSE}; then
    echo -e "${DIM}[DEBUG]${NC} $1" >&2
  fi
}

# Print formatted headers
print_header() {
  if ! ${QUIET}; then
    echo -en "\n${BOLD}${BLUE}$1${NC}\n"
  fi
}

print_section() {
  if ! ${QUIET}; then
    echo -en "\n${CYAN}${BOLD}$1${NC}\n\n"
  fi
}

print_option() {
  if ! ${QUIET}; then
    echo -en "${YELLOW}$1)${CYAN} $2${NC}\n"
  fi
}

print_status() {
  if ! ${QUIET}; then
    echo -en "${GREEN}==>${NC} $1\n"
  fi
}

print_success() {
  if ! ${QUIET}; then
    echo -en "${GREEN}${BOLD}$1${NC}\n"
  fi
}

#==============================================================================
# Error Handling
#==============================================================================

fail() {
  # Usage: fail [message] [exit_code]
  local msg="${1-}"
  local exit_code="${2:-1}"
  if [[ -n ${msg} ]]; then
    log_error "${msg}"
  fi
  exit "${exit_code}"
}

# Trap handler for cleanup
cleanup_on_exit() {
  local exit_code=$?
  [[ -n ${TEMP_DIR} && -d ${TEMP_DIR} ]] && rm -rf "${TEMP_DIR}"
  [[ ${exit_code} -eq 0 ]] && exit 0
  local i
  for ((i = ${#FUNCNAME[@]} - 1; i; i--)); do
    echo "${BASH_SOURCE[i]}:${BASH_LINENO[i]}: ${FUNCNAME[i]}"
  done
  exit "${exit_code}"
}

setup_cleanup() {
  trap 'cleanup_on_exit' EXIT
}

#==============================================================================
# Command and Dependency Checking
#==============================================================================

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  local cmd="$1"
  local install_msg="${2:-Please install ${cmd}}"

  if ! command_exists "${cmd}"; then
    fail "${cmd} is required. ${install_msg}"
  fi
  log_debug "Found required command: ${cmd}"
}

require_script() {
  local script="$1"
  if [[ ! -x ${script} ]]; then
    fail "${script} is required and must be executable. This script has a bug."
  fi
  log_debug "Found required script: ${script}"
}

npm_package_installed() {
  npm list -g "$1" >/dev/null 2>&1
}

go_tool_installed() {
  go list -m "$1" >/dev/null 2>&1 || command_exists "$(basename "$1")"
}

#==============================================================================
# File and Directory Operations
#==============================================================================

file_exists() {
  [[ -f $1 ]]
}

dir_exists() {
  [[ -d $1 ]]
}

ensure_dir() {
  [[ ! -d $1 ]] && mkdir -p "$1"
  log_debug "Ensured directory exists: $1"
}

create_temp_dir() {
  TEMP_DIR=$(mktemp -d)
  log_debug "Created temporary directory: ${TEMP_DIR}"
  echo "${TEMP_DIR}"
}

safe_remove() {
  local path="$1"
  if [[ -e ${path} ]]; then
    rm -rf "${path}"
    log_debug "Removed: ${path}"
  fi
}

#==============================================================================
# Project Structure Helpers
#==============================================================================

get_project_root() {
  local root
  if command_exists git; then
    root=$(git rev-parse --show-toplevel 2>/dev/null || true)
  fi
  if [[ -n ${root} ]]; then
    echo "${root}"
  else
    # Fallback to current working directory
    pwd
  fi
}
PROJECT_ROOT="$(get_project_root)"
export PROJECT_ROOT

#==============================================================================
# Development Tool Helpers
#==============================================================================

install_trunk() {
  if command_exists trunk; then
    log_debug "trunk already installed"
    return 0
  fi

  log_info "Installing trunk..."
  curl -fsSL https://get.trunk.io | bash
  log_success "trunk installed successfully"
}

install_doctoc() {
  require_command npm "Please install Node.js and npm first"

  if npm_package_installed doctoc; then
    log_debug "doctoc already installed"
    return 0
  fi

  log_info "Installing doctoc..."
  npm install -g doctoc
  log_success "doctoc installed successfully"
}

install_go_tools() {
  local tools=(
    "golang.org/x/tools/cmd/goimports@latest"
    "github.com/segmentio/golines@latest"
    "github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
  )

  log_info "Installing Go development tools..."
  for tool in "${tools[@]}"; do
    log_info "Installing $(basename "${tool}")..."
    go install "${tool}"
  done
  log_success "Go tools installed successfully"
}

#==============================================================================
# Validation Helpers
#==============================================================================

validate_go_project() {
  require_command go "Please install Go first"

  local project_root
  project_root=$(get_project_root)

  if [[ ! -f "${project_root}/go.mod" ]]; then
    fail "Not a Go project (no go.mod found)"
  fi

  log_debug "Validated Go project structure"
}

validate_git_repo() {
  require_command git "Please install git first"

  local project_root
  project_root=$(get_project_root)

  if [[ ! -d "${project_root}/.git" ]]; then
    fail "Not a git repository"
  fi

  log_debug "Validated git repository"
}

#==============================================================================
# Common Argument Parsing
#==============================================================================

parse_common_args() {
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
      # Return unhandled arguments
      break
      ;;
    esac
  done

  # Return remaining arguments
  # Echo any remaining unhandled arguments for callers to capture
  if [[ $# -gt 0 ]]; then
    echo "$@"
  fi
  return 0
}

#==============================================================================
# Common Operations
#==============================================================================

run_with_status() {
  local description="$1"
  shift
  local cmd="$*"

  print_status "${description}"
  log_debug "Running: ${cmd}"

  if eval "${cmd}"; then
    log_success "${description} completed"
    return 0
  else
    local exit_code=$?
    log_error "${description} failed (exit code: ${exit_code})"
    return "${exit_code}"
  fi
}

update_go_modules() {
  run_with_status "Updating Go modules" "go mod tidy && go mod verify"
}

run_tests() {
  run_with_status "Running tests" "go test -v ./..."
}

run_build() {
  run_with_status "Building project" "go build -v ./..."
}

run_lint() {
  require_command trunk "Please install trunk first"
  run_with_status "Running linting" "trunk check"
}

#==============================================================================
# Default Help Function
#==============================================================================

show_help() {
  # Extract header comment block and format it
  local script_file="${BASH_SOURCE[1]}"

  if [[ ! -f ${script_file} ]]; then
    echo "Help information not available"
    return
  fi

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

#==============================================================================
# Utility Functions
#==============================================================================

pause() {
  [[ ${QUIET} == true ]] && return
  echo
  read -n 1 -s -r -p "Press any key to continue..."
  echo
}

confirm() {
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

#==============================================================================
# Initialization
#==============================================================================

# Set up cleanup trap when library is sourced
setup_cleanup

init() {
  parse_common_args "$@"
  if [[ ${BASH_SOURCE[0]} == "${0}" ]]; then
    echo "This script should be sourced, not executed directly."
    # shellcheck disable=SC2016
    echo 'Usage: source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"/lib.sh'
    exit 1
  fi
}
# Do not auto-run init when this file is sourced; allow callers to invoke init() explicitly if needed.
