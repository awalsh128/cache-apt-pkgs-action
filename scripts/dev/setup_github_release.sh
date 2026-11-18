#!/usr/bin/env bash
# Sets up this repository's v2 release pipeline (staging-2 -> main-2) with Octo STS: creates staging-2
# when missing, makes it the default branch (Octo STS reads trust policies from the default branch),
# creates the 'release' environment (main-2 and staging-2 only), checks that the trust policies are on
# the default branch, and applies .github/rulesets/*.json with the Octo STS app allowed to bypass the
# main-2 and release tag rulesets. The v1 branch (master) is never touched. Safe to rerun.
#
# Usage: setup_github_release.sh [-n] [-r owner/repo] [-e environment]
#   -n  Dry run: print what would be done.
#   -r  Target repo (default: the current directory's GitHub repo).
#   -e  Environment name (default: release).
# Run it with `gh` logged in as an admin of the repository, after the pipeline files are on main-2.
set -euo pipefail

dry_run=false
repo=""
environment="release"
while getopts "nr:e:h" opt; do
  case "$opt" in
    n) dry_run=true ;;
    r) repo="$OPTARG" ;;
    e) environment="$OPTARG" ;;
    *) sed -n '2,12p' "$0"; exit 1 ;;
  esac
done
repo="${repo:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
branches=(main-2 staging-2)

step() { printf '\n==> %s\n' "$*"; }
run() {
  echo "+ $*"
  "$dry_run" || "$@"
}

echo "Repository: $repo"
app_id="$(gh api /apps/octo-sts --jq .id)"

step "Branch staging-2"
if gh api "repos/$repo/branches/staging-2" --silent 2>/dev/null; then
  echo "staging-2 exists."
else
  main_sha="$(gh api "repos/$repo/git/ref/heads/main-2" --jq .object.sha)"
  run gh api -X POST "repos/$repo/git/refs" -f ref=refs/heads/staging-2 -f sha="$main_sha" --silent
fi

step "Default branch staging-2"
run gh repo edit "$repo" --default-branch staging-2
default_branch="staging-2"

step "Environment '$environment' (${branches[*]} only)"
run gh api -X PUT "repos/$repo/environments/$environment" \
  -F deployment_branch_policy[protected_branches]=false \
  -F deployment_branch_policy[custom_branch_policies]=true --silent
existing="$(gh api "repos/$repo/environments/$environment/deployment-branch-policies" \
  --jq '.branch_policies[].name' 2>/dev/null || true)"
for branch in "${branches[@]}"; do
  if grep -qx "$branch" <<<"$existing"; then
    echo "$branch is already allowed."
  else
    run gh api -X POST "repos/$repo/environments/$environment/deployment-branch-policies" \
      -f name="$branch" -f type=branch --silent
  fi
done

step "Octo STS trust policies on $default_branch"
for file in .github/chainguard/*.sts.yaml; do
  if gh api "repos/$repo/contents/$file?ref=$default_branch" --silent 2>/dev/null; then
    echo "ok       $file"
  else
    echo "missing  $file (commit it to $default_branch; Octo STS reads it from there)"
  fi
done

step "Rulesets (Octo STS app $app_id may bypass the main-2 and tag rulesets)"
for file in .github/rulesets/*.json; do
  name="$(jq -r .name "$file")"
  body="$(jq --argjson id "$app_id" \
    'if (.bypass_actors | length) > 0 then .bypass_actors[0].actor_id = $id else . end' "$file")"
  id="$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id")"
  if [[ -n "$id" ]]; then
    echo "+ update ruleset '$name' ($id)"
    "$dry_run" || gh api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$body" >/dev/null
  else
    echo "+ create ruleset '$name'"
    "$dry_run" || gh api -X POST "repos/$repo/rulesets" --input - <<<"$body" >/dev/null
  fi
done

printf '\n[MANUAL] Install the Octo STS app on %s (Only select repositories):\n         https://github.com/apps/octo-sts\n' "$repo"
