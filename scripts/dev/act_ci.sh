#!/usr/bin/env bash
set -euo pipefail

# Must match the -P runner image in .actrc.
IMAGE_TAG="cache-apt-pkgs-action-ci:local"

usage() {
  cat <<'EOF'
Usage:
  scripts/dev/act_ci.sh build-image
  scripts/dev/act_ci.sh quick
  scripts/dev/act_ci.sh integration
  scripts/dev/act_ci.sh job <job-name>
  scripts/dev/act_ci.sh push

Commands:
  build-image  Build the local act runner image.
  quick        Run core CI quality jobs.
  integration  Run action integration/regression jobs.
  job          Run a specific ci.yml job by name.
  push         Run the full push workflow simulation.
EOF
}

require_tools() {
  command -v docker >/dev/null 2>&1 || {
    echo "docker is required" >&2
    exit 1
  }

  command -v act >/dev/null 2>&1 || {
    echo "nektos/act is required: https://github.com/nektos/act" >&2
    exit 1
  }
}

build_image() {
  docker build -f .github/act/Dockerfile -t "${IMAGE_TAG}" .
}

# Workflow, event, platform, and runner image flags come from the repo-root .actrc.
act_run() {
  act "$@"
}

run_quick() {
  local jobs=(
    setup-and-cache
    linters
    action-deps-pinned
    testing
  )

  for job in "${jobs[@]}"; do
    echo "Running job: ${job}"
    act_run push --job "${job}"
  done
}

run_integration() {
  local jobs=(
    list_versions
    standard_workflow_install
    standard_workflow_restore
    standard_workflow_add_package
    standard_workflow_restore_add_package
    regression_84_literal_block_install
    regression_84_literal_block_restore
    regression_84_folded_block_install
    regression_84_folded_block_restore
  )

  for job in "${jobs[@]}"; do
    echo "Running job: ${job}"
    act_run push --job "${job}"
  done
}

main() {
  require_tools
  cd "$(git rev-parse --show-toplevel)"

  # ci.yml checks out explicit refs; with --bind (or a --reuse'd bound container) that checkout
  # runs as root against this working tree and cleans away all uncommitted and ignored files.
  if grep -qE '^(--bind|--reuse)\b' .actrc; then
    echo ".actrc must not set --bind or --reuse; checkout would wipe the working tree" >&2
    exit 1
  fi

  if [[ $# -lt 1 ]]; then
    usage
    exit 1
  fi

  case "$1" in
  build-image)
    build_image
    ;;
  quick)
    build_image
    run_quick
    ;;
  integration)
    build_image
    run_integration
    ;;
  job)
    if [[ $# -ne 2 ]]; then
      echo "job requires a job name" >&2
      usage
      exit 1
    fi
    build_image
    act_run push --job "$2"
    ;;
  push)
    build_image
    act_run push
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage
    exit 1
    ;;
  esac
}

main "$@"
