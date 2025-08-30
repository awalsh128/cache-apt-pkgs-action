#!/bin/bash

#==============================================================================
# menu.sh
#==============================================================================
# 
# DESCRIPTION:
#   Interactive menu for running project scripts and common tasks.
#   Provides easy access to development, testing, and maintenance tasks.
#
# USAGE:
#   ./scripts/menu.sh
#
# FEATURES:
#   - Interactive menu interface
#   - Clear task descriptions
#   - Status feedback
#   - Error handling
#
# DEPENDENCIES:
#   - bash
#   - Various project scripts
#==============================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Function to print section headers
print_header() {
    echo -e "\n${BOLD}${BLUE}$1${NC}\n"
}

# Function to print status messages
print_status() {
    echo -e "${GREEN}==>${NC} $1"
}

# Function to print errors
print_error() {
    echo -e "${RED}Error:${NC} $1"
}

# Function to wait for user input before continuing
pause() {
    echo
    read -n 1 -s -r -p "Press any key to continue..."
    echo
}

# Function to run a command and handle errors
run_command() {
    local cmd="$1"
    local description="$2"
    
    print_status "Running: $description"
    echo "Command: $cmd"
    echo
    
    if eval "$cmd"; then
        print_status "Successfully completed: $description"
    else
        print_error "Failed: $description"
        echo "Exit code: $?"
    fi
    
    pause
}

# Main menu
while true; do
    clear
    print_header "Cache Apt Packages Action - Development Menu"
    echo "1) Setup Development Environment"
    echo "2) Update Markdown TOCs"
    echo "3) Run Tests"
    echo "4) Run Linting (trunk check)"
    echo "5) Build Project"
    echo "6) Check UTF-8 Encoding"
    echo "7) Run All Checks (tests, lint, build)"
    echo "8) Run All Script Tests"
    echo
    echo "9) Show Project Status"
    echo "10) Show Recent Git Log"
    echo "11) Export Version Information"
    echo
    echo "q) Quit"
    echo
    read -p "Select an option: " choice
    echo

    case $choice in
        1)
            run_command "./scripts/setup_dev.sh" "Setting up development environment"
            ;;
        2)
            run_command "./scripts/update_md_tocs.sh" "Updating markdown tables of contents"
            ;;
        3)
            run_command "go test -v ./..." "Running tests"
            ;;
        4)
            run_command "trunk check" "Running linting checks"
            ;;
        5)
            run_command "go build -v ./..." "Building project"
            ;;
        6)
            run_command "./scripts/check_utf8.sh" "Checking UTF-8 encoding"
            ;;
        7)
            print_header "Running All Checks"
            run_command "go test -v ./..." "Running tests"
            run_command "trunk check" "Running linting checks"
            run_command "go build -v ./..." "Building project"
            run_command "./scripts/check_utf8.sh" "Checking UTF-8 encoding"
            ;;
        8)
            print_header "Running All Script Tests"
            run_command "./scripts/tests/setup_dev_test.sh" "Running setup dev tests"
            run_command "./scripts/tests/check_utf8_test.sh" "Running UTF-8 check tests"
            run_command "./scripts/tests/update_md_tocs_test.sh" "Running markdown TOC tests"
            run_command "./scripts/tests/export_version_test.sh" "Running version export tests"
            run_command "./scripts/tests/distribute_test.sh" "Running distribute tests"
            ;;
        9)
            print_header "Project Status"
            echo "Git Status:"
            git status
            echo
            echo "Go Module Status:"
            go mod verify
            pause
            ;;
        10)
            print_header "Recent Git Log"
            git log --oneline -n 10
            pause
            ;;
        11)
            run_command "./scripts/export_version.sh" "Exporting version information"
            ;;
        q|Q)
            print_status "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            pause
            ;;
    esac
done
