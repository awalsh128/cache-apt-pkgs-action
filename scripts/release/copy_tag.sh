#!/bin/bash
# Point a (moving) tag, e.g. v1 or latest, at the commit of another tag.
# Run from anywhere inside a clone of this repository.

set -euo pipefail

# shellcheck source=lib.sh
source "$(dirname -- "$(realpath -- "${0}")")/lib.sh"
usage_msg=$(usage "${0}" "<source tag> <target tag>")

source_tag="${1:-}"
validate_arg "${source_tag}" "Source tag arg must be non-empty." "${usage_msg}"

target_tag="${2:-}"
validate_arg "${target_tag}" "Target tag arg must be non-empty." "${usage_msg}"

cd "$(git rev-parse --show-toplevel)"
git fetch origin --tags --force

if ! git rev-parse --verify --quiet "refs/tags/${source_tag}" > /dev/null; then
  echo "error: source tag '${source_tag}' does not exist." >&2
  exit 1
fi

confirm_prompt "Do you want to update '${target_tag}' from '${source_tag}'?"

git tag -fa "${target_tag}" -m "Points ${target_tag} to ${source_tag}." "${source_tag}^{commit}"
git push --force origin "refs/tags/${target_tag}"
