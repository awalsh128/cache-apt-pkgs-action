#!/bin/bash

#==============================================================================
# update_trunkio.sh
#==============================================================================
#
# DESCRIPTION:
#   Configures and updates the TrunkIO extension.
#
# USAGE:
#   update_trunkio.sh
#==============================================================================

source "$(git rev-parse --show-toplevel)/scripts/lib.sh"

trunk upgrade
trunk check list --fix --print-failures

# TODO: Automatically enable any disabled linters except for cspell
# DISABLED_LINTERS="$(trunk check list | grep '◯' | grep "files" | awk -F ' ' '{print $2}')"
# for linter in $DISABLED_LINTERS; do
#   echo "trunk check enable $linter;"
# done