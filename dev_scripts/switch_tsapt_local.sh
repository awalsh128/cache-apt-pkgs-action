#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090
source "${SCRIPT_DIR}/lib.sh"

PACKAGE_PATH="${SCRIPT_DIR}/../package.json"
LOCAL_VAL="file:../ts-apt"
NPM_VAL="^$(npm view ts-apt version 2> /dev/null | tr -d '\n')"

function is_local_switched() {
  grep -q "\"ts-apt\": \"${LOCAL_VAL}\"," "${PACKAGE_PATH}"
}

function switch() {
  if ! is_local_switched; then
    echo "Switching ts-apt dependency to local path '${LOCAL_VAL}'..."
    if [[ ! -d "${SCRIPT_DIR}/../ts-apt" ]]; then
      echo "Local ts-apt path '${LOCAL_VAL}' does not exist. Checking out..."
      clone_repo "ts-apt" "${SCRIPT_DIR}/../ts-apt"
    fi
    sed -i "s#\"ts-apt\": \".*\",#\"ts-apt\": \"${LOCAL_VAL}\",#" "${PACKAGE_PATH}"
    echo "Switched to local ts-apt. Run 'npm install --ignore-scripts' to refresh node_modules and package-lock.json."
  else
    echo "Switching ts-apt dependency to NPM version '${NPM_VAL}'..."
    sed -i "s#\"ts-apt\": \".*\",#\"ts-apt\": \"${NPM_VAL}\",#" "${PACKAGE_PATH}"
    echo "Switched to published ts-apt. Run 'npm install --ignore-scripts' to refresh node_modules and package-lock.json."
  fi
}

if [[ "$1" == "--is_local_switched" ]]; then
  is_local_switched
else
  switch
fi