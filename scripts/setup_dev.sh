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
#   setup_dev.sh [options]
#
# OPTIONS:
#   -v, --verbose    Enable verbose output
#   -h, --help      Show this help message
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"

parse_common_args "$@"

#==============================================================================
# Setup Functions
#==============================================================================

check_prerequisites() {
  print_status "Checking prerequisites"

  require_command go "Please install Go first (https://golang.org/dl/)"
  require_command npm "Please install Node.js and npm first (https://nodejs.org/)"
  require_command git "Please install git first"
  require_command curl "Please install curl first"

  log_success "All prerequisites are available"
}

setup_go_environment() {
  validate_go_project

  print_status "Configuring Go environment"
  go env -w GO111MODULE=auto

  update_go_modules
}

install_development_tools() {
  print_status "Installing development tools"

  install_trunk
  install_doctoc
  install_go_tools

  log_success "All development tools installed"
}

setup_git_hooks() {
  validate_git_repo

  print_status "Setting up Git hooks"

  # Initialize trunk if not already done
  if [[ ! -f .trunk/trunk.yaml ]]; then
    log_info "Initializing trunk configuration"
    trunk init
  fi

  # Configure git hooks
  git config core.hooksPath .git/hooks/

  log_success "Git hooks configured"
}

update_project_documentation() {
  print_status "Updating project documentation"

  local update_script="${SCRIPT_DIR}/update_md_tocs.sh"
  if [[ -x ${update_script} ]]; then
    "${update_script}"
  else
    log_warn "Markdown TOC update script not found or not executable"
  fi
}

run_initial_checks() {
  print_status "Running initial project validation"

  # Run trunk check
  if command_exists trunk; then
    run_with_status "Running initial linting" "trunk check --no-fix"
  fi

  # Run tests
  run_tests

  log_success "Initial validation completed"
}

display_completion_message() {
  print_header "Development Environment Setup Complete!"

  echo "Available commands:"
  echo "  • Run tests:             go test ./..."
  echo "  • Run linting:           trunk check"
  echo "  • Update documentation:  ./scripts/update_md_tocs.sh"
  echo "  • Interactive menu:      ./scripts/menu.sh"
  echo
  log_success "Ready for development!"
}

#==============================================================================
# Main Setup Process
#==============================================================================

main() {
  # Parse command line arguments first
  while [[ $# -gt 0 ]]; do
    case $1 in
    -v | --verbose)
      export VERBOSE=true
      ;;
    -h | --help)
      cat <<'EOF'
USAGE:
  setup_dev.sh [OPTIONS]

DESCRIPTION:
  Sets up the development environment for the cache-apt-pkgs-action project.
  Installs all necessary tools, configures Go environment, and sets up
  pre-commit hooks.

OPTIONS:
  -v, --verbose    Enable verbose output
  -h, --help       Show this help message
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Use --help for usage information." >&2
      exit 1
      ;;
    esac
    shift
  done

  print_header "Setting up Development Environment"

  # Run setup steps
  check_prerequisites
  setup_go_environment
  install_development_tools
  setup_git_hooks
  update_project_documentation
  run_initial_checks
  display_completion_message
}

#==============================================================================
# Entry Point
#==============================================================================

main "$@"
