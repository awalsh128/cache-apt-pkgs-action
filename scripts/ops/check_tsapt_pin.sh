#!/usr/bin/env bash
# Fails when ts-apt is not resolved from a pushed commit SHA pin.
#
# Guards against shipping code built or tested against a local ts-apt link
# (npm run dev:tsapt:link), which CI cannot see. Checks that:
#   1. node_modules/ts-apt is not a symlink (skipped if node_modules is absent).
#   2. package.json pins ts-apt to a full commit SHA.
#   3. package-lock.json resolves ts-apt to that same SHA and not a link.
#
# Used by .githooks/pre-push and the CI action-deps-pinned job.
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "${ROOT_DIR}"

errors=0
error() {
  echo "ERROR: $*" >&2
  errors=$((errors + 1))
}

if [[ -L node_modules/ts-apt ]]; then
  error "node_modules/ts-apt is a symlink to $(readlink node_modules/ts-apt); run 'npm run dev:tsapt:unlink' first."
fi

# Prints one problem per line; package.json and package-lock.json are parsed
# with node to avoid a jq dependency.
lock_problems="$(node --input-type=module - <<'EOF'
import { readFileSync } from "node:fs";
const pin = /^git\+https:\/\/github\.com\/awalsh128\/ts-apt\.git#([0-9a-f]{40})$/;
const spec = JSON.parse(readFileSync("package.json", "utf8")).dependencies?.["ts-apt"];
const match = pin.exec(spec ?? "");
if (!match) {
  console.log(`package.json ts-apt '${spec}' is not pinned to a full commit SHA.`);
  process.exit(0);
}
const sha = match[1];
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const rootSpec = lock.packages?.[""]?.dependencies?.["ts-apt"];
if (rootSpec !== spec) {
  console.log(`package-lock.json root ts-apt '${rootSpec}' does not match package.json '${spec}'.`);
}
const entry = lock.packages?.["node_modules/ts-apt"];
if (!entry) {
  console.log("package-lock.json has no node_modules/ts-apt entry.");
} else if (entry.link) {
  console.log(`package-lock.json ts-apt is a link to '${entry.resolved}'.`);
} else if (!entry.resolved?.endsWith(`#${sha}`)) {
  console.log(`package-lock.json ts-apt resolved '${entry.resolved}' does not match pin ${sha}.`);
}
EOF
)"

if [[ -n "${lock_problems}" ]]; then
  while IFS= read -r problem; do
    error "${problem}"
  done <<<"${lock_problems}"
fi

if ((errors > 0)); then
  echo "ts-apt pin check failed with ${errors} error(s)." >&2
  exit 1
fi

echo "ts-apt pin check passed."
