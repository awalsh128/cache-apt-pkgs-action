#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1090
source "${SCRIPT_DIR}/lib.sh"

PACKAGE_PATH="${SCRIPT_DIR}/../package.json"
LOCAL_VAL="../../ts-apt"
NPM_VAL="^ts-apt/$(npm view ts-apt version 2> /dev/null | tr -d '\n')"

if ! grep -q "\"ts-apt\": \"${LOCAL_VAL}\"," "${PACKAGE_PATH}"; then
  echo "Switching ts-apt dependency to local path '${LOCAL_VAL}'..."
  if [[ ! -d "${SCRIPT_DIR}/../ts-apt" ]]; then
    echo "Local ts-apt path '${LOCAL_VAL}' does not exist. Checking out..."
    clone_repo "ts-apt" "${SCRIPT_DIR}/../ts-apt"
  fi
  sed -i "s#\"ts-apt\": \".*\",#\"ts-apt\": \"${LOCAL_VAL}\",#" "${PACKAGE_PATH}"
else
  echo "Switching ts-apt dependency to NPM version '${NPM_VAL}'..."
  sed -i "s#\"ts-apt\": \".*\",#\"ts-apt\": \"${NPM_VAL}\",#" "${PACKAGE_PATH}"
fi