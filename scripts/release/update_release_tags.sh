#!/bin/bash
# Move the floating release tags (v1 and latest) to a released version tag.
# Run from anywhere inside a clone of this repository.

set -euo pipefail

script_dir="$(dirname -- "$(realpath -- "${0}")")"
# shellcheck source=lib.sh
source "${script_dir}/lib.sh"
usage_msg=$(usage "${0}" "<version tag, e.g. v1.5.3>")

version="${1:-}"
validate_arg "${version}" "Version tag arg must be non-empty." "${usage_msg}"

"${script_dir}/copy_tag.sh" "${version}" v1
"${script_dir}/copy_tag.sh" "${version}" latest
