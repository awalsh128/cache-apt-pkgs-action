# Contributing

This document contains maintainer-oriented notes that are intentionally separated from the user-facing README.

## Development Environment

`./scripts/dev` containing all development related concerns. To get started after cloning the repository you
can run `./scripts/dev/setup_devenv.mts run --ide [your IDE]`. This will setup some of the common settings and
extensions typically used. You do not have to use this though.

To quickly establish credentials you can run `./scripts/dev/gh_auth.sh`. It is just a helper script to get you
authenticated with GitHub.

```sh

```

## Workflow Concerns

### Quality and Security

Primary CI is defined in [.github/workflows/ci.yml](.github/workflows/ci.yml).

- Triggers: `pull_request`, nightly `schedule`, and `workflow_dispatch`.
- This workflow is the merge gate for PRs; it does not publish releases.
- Job groups by concern:
  - Setup and build artifact reuse via [.github/actions/setup/action.yml](.github/actions/setup/action.yml).
  - Static quality gates: lint and typecheck.
  - Test quality gates: test suite and type coverage threshold.
  - Security gates: CodeQL analysis and dependency audit (`npm audit --audit-level=high --omit=dev`).
  - Coverage: Codecov upload from `coverage/lcov.info`.

### Pull Request Branch Policy

- Branch policy is enforced by [.github/workflows/pr.yml](.github/workflows/pr.yml) and [scripts/ops/pr_checks.mts](scripts/ops/pr_checks.mts).
- Feature branches should target `staging`.
- `main` only accepts merges from `staging`.
- A release-bot role has bypass permission for the `main` and `staging` branch protections.

Pull request policy checks are defined in [.github/workflows/pr.yml](.github/workflows/pr.yml).

- Triggered on PR open/update/reopen/edited events.
- Runs `npm run check:pr` to enforce branch policy and pinned action ref validation.
- Pull requests into `main` must come from `staging`.
- Treat short-lived task branches as disposable and prefer deleting them after merge.

### Branch Sync and Merge Policy

Branch ancestry enforcement is defined in [.github/workflows/branch-sync.yml](.github/workflows/branch-sync.yml).

- Triggered on pushes to `main`, on a daily schedule, and manually via `workflow_dispatch`.
- Verifies that `staging` remains an ancestor of `main`.
- `staging` into `main` should preserve ancestry with a merge commit; squash and rebase merges break this guardrail.
- If `staging` ancestry is broken, repair it immediately with a merge-commit-based sync before taking further releases.

### Release and Publishing

Release automation is defined in [.github/workflows/release.yml](.github/workflows/release.yml) and uses semantic-release.

- Triggers: push to `main` or `staging`, plus `workflow_dispatch`.
- `staging` produces prereleases on the `next` channel with `rc` suffixes.
- `main` produces stable releases and deploys API docs to GitHub Pages.
- semantic-release updates package metadata as part of its own prepare/commit flow.
- The release-bot GitHub App token is used so the release job can publish, tag, and push release commits back to the branch that triggered it.

Release configuration is in [release.config.ts](release.config.ts).

## Conventional Commits

semantic-release determines version bump level from commit messages.

Examples:

```bash
git commit -m "fix(parser): handle empty package output"
git commit -m "feat(manager): add availability check"
git commit -m "feat!: remove deprecated API"
```

## Repository Scripts

Repository scripts are grouped under [scripts/dev](scripts/dev) and [scripts/ops](scripts/ops).

- [check_latest_action_pin.mts](scripts/ops/check_latest_action_pin.mts): checks whether pinned GitHub Action refs are up to date against upstream releases.
- [check_release_tag.mts](scripts/ops/check_release_tag.mts): validates release tag format and consistency with `package.json` version.
- [create_testcase_logs.mts](scripts/dev/create_testcase_logs.mts): regenerates command execution logs used by integration/parser fixtures.
- [hotfix_pr.mts](scripts/dev/hotfix_pr.mts): automates hotfix branch creation and PR creation/update flow.
- [gh_sync.mts](scripts/dev/gh_sync.mts): synchronizes repository settings, rulesets, variables, and tags JSON. **These are not for source control** since they leak information.
- [setup_devenv.mts](scripts/dev/setup_devenv.mts): bootstraps local developer dependencies, workspace settings, and npm audit remediation.
- [node_ver.mts](scripts/dev/node_ver.mts): verifies or updates Node version alignment across repo files and local Node installation.

## Integration Test Notes

Integration test suite is [test/ubuntu.integration.test.ts](test/ubuntu.integration.test.ts).

- These tests execute real APT commands and are environment-sensitive.
- They are intentionally narrower than unit tests to keep runtime manageable.
- Mutating package operations should use locking for safety when applicable.

## Docs and Publishing

- API docs are generated into [docs/api](docs/api) and are generated during the release process, not
  committed to source.
- Release workflow publishes package artifacts and deploys docs via GitHub Pages.

## Operational Concerns

- Node.js baseline is managed in [package.json](package.json) engines.
- Keep `package-lock.json` committed and synchronized with dependency changes.
- Prefer updating workflow action SHAs with care and validate in CI.
- Prefer full commit SHA pinning for all third-party GitHub Actions.
- Repository settings, rulesets, variables, and tags are synchronized via `scripts/dev/gh_sync.mts`.
- Repository settings are tracked in [.github/repo-settings.json](.github/repo-settings.json) and can be applied with `npm run repo:settings:upload`.
- Repository rulesets are tracked in [.github/repo-rulesets.json](.github/repo-rulesets.json) and can be applied with `npm run repo:rulesets:upload`.
- Repository variables are tracked in `.github/repo-vars.json` and can be applied with `npm run repo:vars:upload`.
- Repository tags are tracked in `.github/repo-tags.json` and can be applied with `npm run repo:tags:upload`.
- Use `npm run repo:all:download` and `npm run repo:all:upload` to synchronize every tracked GitHub metadata target in one pass.
- Prefer explicit status checks and branch protections over informal merge discipline.
- Keep release automation branch-based and semantic-release driven.
