#!/usr/bin/env bash
# Makes earlier releases visible to semantic-release, which only counts a tag reachable from HEAD.
#
# A release tags a detached commit (the released source plus the built dist/, see release.config.ts)
# that is on no branch, so no later HEAD contains it. Without this, the next run finds only the last
# release tag that is on the branch and computes a version that already exists, which fails at the tag.
#
# semantic-release lists tags with `git tag --merged <branch>`, so this moves the checked-out local
# branch (not just HEAD) to a commit with the same tree that has each earlier release commit as an extra
# parent. It is local only: nothing is pushed (a release pushes tags only), the working tree is
# unchanged, and the commit is a `chore` so it doesn't trigger a release. The new release commit is
# built on it, so it keeps every earlier release in its history.
set -euo pipefail

branch="$(git symbolic-ref --short HEAD)" # Fails on a detached HEAD, which this can't repair.

# Release commits are made by release.config.ts with this exact subject and are on no branch.
unreachable=()
while read -r tag; do
  if [[ "$(git log -1 --format=%s "$tag^{commit}")" == "chore(release): "*" [skip ci]" ]]; then
    unreachable+=("$tag")
  fi
done < <(git tag --list 'v[0-9]*' --no-merged HEAD)

if ((${#unreachable[@]} == 0)); then
  echo "No release tag is missing from HEAD's history."
  exit 0
fi

parents=(-p HEAD)
for tag in "${unreachable[@]}"; do
  parents+=(-p "$tag^{commit}")
done

merge="$(
  GIT_AUTHOR_NAME="github-actions[bot]" \
    GIT_AUTHOR_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" \
    GIT_COMMITTER_NAME="github-actions[bot]" \
    GIT_COMMITTER_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" \
    git commit-tree 'HEAD^{tree}' "${parents[@]}" -m "chore: attach earlier releases [skip ci]"
)"
git update-ref "refs/heads/$branch" "$merge"
echo "Attached ${#unreachable[@]} earlier release(s) (${unreachable[*]}) to $branch at $merge"
