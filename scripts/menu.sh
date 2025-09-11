#!/bin/bash

#==============================================================================
# menu.sh
#==============================================================================
#
# DESCRIPTION:
#   Streamlined interactive menu for essential development tasks.
#   Provides quick access to the most commonly used development operations.
#
# USAGE:
#   menu.sh
#
# OPTIONS:
#   -v, --verbose   Enable verbose output
#   -h, --help      Show this help message
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"
SCRIPT_DIR="${PROJECT_ROOT}/scripts"
CAP_CMD_DIR="${PROJECT_ROOT}/cmd/cache_apt_pkgs"

parse_common_args "$@" >/dev/null # prevent return from echo'ng

#==============================================================================
# Menu Operations
#==============================================================================

run_task() {
  local description="$1"
  shift
  local cmd="$*"

  print_status "Running: ${description}"
  [[ ${VERBOSE} == true ]] && log_debug "Command: ${cmd}"

  echo
  if eval "${cmd}"; then
    log_success "${description} completed successfully"
  else
    local exit_code=$?
    log_error "${description} failed (exit code: ${exit_code})"
  fi

  pause
}

show_project_status() {
  print_header "Project Status"

  echo "Git Status:"
  git status --short --branch
  echo

  echo "Go Module Status:"
  go mod verify && log_success "Go modules are valid"
  echo

  if command_exists trunk; then
    echo "Linting Status:"
    trunk check --no-fix --quiet || log_warn "Linting issues detected"
    echo
  fi

  pause
}

#==============================================================================
# Main Menu Loop
#==============================================================================

main_menu() {
  while true; do
    clear
    print_header "Cache Apt Packages - Development Menu"

    print_section "Essential Tasks:"
    print_option 1 "Setup Development Environment"
    print_option 2 "Run All Checks (test + lint + build)"
    print_option 3 "Test Only"
    print_option 4 "Lint & Fix"
    print_option 5 "Build Project"

    print_section "Maintenance:"
    print_option 6 "Update Documentation (TOCs)"
    print_option 7 "Export Version Info"

    print_section "Information:"
    print_option 8 "Project Status"
    print_option 9 "Recent Changes"
    echo
    print_option q "Quit"
    echo

    echo_color -n green "choice > "
    read -n 1 -rp "" choice
    printf "\n\n"

    case ${choice} in
    1)
      run_task "Setting up development environment" \
        "${SCRIPT_DIR}/setup_dev.sh"
      ;;
    2)
      print_header "Running All Checks"
      echo ""
      run_task "Running linting" "trunk check --fix"
      run_task "Building project" "go build -v ${CAP_CMD_DIR}"
      run_task "Running tests" "go test -v ${CAP_CMD_DIR}"
      ;;
    3)
      run_task "Running tests" "go test -v ${CAP_CMD_DIR}"
      ;;
    4)
      run_task "Running lint with fixes" "trunk check --fix"
      ;;
    5)
      run_task "Building project" "go build -v ${CAP_CMD_DIR}"
      ;;
    6)
      run_task "Updating documentation TOCs" \
        "${SCRIPT_DIR}/update_md_tocs.sh"
      ;;
    7)
      run_task "Exporting version information" \
        "${SCRIPT_DIR}/export_version.sh"
      ;;
    8)
      show_project_status
      ;;
    9)
      print_header "Recent Changes"
      git log --oneline --graph --decorate -n 10
      pause
      ;;
    q | Q | "")
      echo -e "${GREEN}Goodbye!${NC}"
      exit 0
      ;;
    *)
      echo ""
      log_error "Invalid option: ${choice}"
      pause
      ;;
    esac
  done
}

#==============================================================================
# Entry Point
#==============================================================================

# Validate project structure
# validate_go_project
# validate_git_repo

# Parse any command line arguments
parse_common_args "$@"

# Run main menu
main_menu
