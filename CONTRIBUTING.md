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

### Branches and Release Flow

`master` is frozen for v1 and is never changed. v2 uses two protected branches (rulesets in
[.github/rulesets](.github/rulesets)):

- `staging-2`: pull requests target it. Squash merge only, with a Conventional Commit title. Requires the
  `ci-passed` and `check-branch` status checks.
- `main-2`: nobody pushes to it. Only the Octo STS app (via `promote.yml`) fast-forwards it, so it is always
  an ancestor of `staging-2`.

Flow:

1. Open a PR to `staging-2`. [pr.yml](.github/workflows/pr.yml) and
   [scripts/ops/pr_checks.mts](scripts/ops/pr_checks.mts) enforce branch policy and action pinning.
2. After the squash merge, [ci.yml](.github/workflows/ci.yml) runs on `staging-2`, and again on `main-2` after
   each promotion. When CI passes, [release-candidate.yml](.github/workflows/release-candidate.yml) starts
   `release.yml`, which tags a release candidate (`vX.Y.Z-rc.N`) if the commits since the last release call
   for one (`feat`, `fix` or breaking; `docs`, `ci`, `chore` and `test` release nothing). Official versions
   only change at promotion.
3. Run [promote.yml](.github/workflows/promote.yml) (workflow dispatch on `staging-2`). It requires CI success
   for the `staging-2` head, fast-forwards `main-2`, and starts the official release.
4. `release.yml` on `main-2` computes one version from all the commits since the last release, tags `vX.Y.Z`,
   creates the GitHub Release, and attests the bundle. It then moves the floating `v2` tag to that release
   (stable releases only, never a candidate). `v2` is the only mutable tag: the rulesets in
   [.github/rulesets](.github/rulesets) make every exact `v2.*` tag immutable, and only the release app can
   create or move `v2`.
5. To start a candidate yourself, run [release.yml](.github/workflows/release.yml) by hand on `staging-2`
   (`dry-run` previews without tagging).

Releases never commit to a branch. `dist/` is gitignored, so semantic-release tags a detached commit (released
source plus built `dist/`, see [release.config.ts](release.config.ts)). That commit is what
`uses: awalsh128/cache-apt-pkgs-action@v2.1.0` runs.

No secrets are stored. Tags and the `main-2` update use Octo STS tokens issued under
[.github/chainguard](.github/chainguard). Use `scripts/dev/setup_github_release.sh -n` to preview the one-time
GitHub setup (branches, `release` environment, rulesets).

The first release from `main-2` must include a breaking change (`feat!:` title or a `BREAKING CHANGE:`
footer). Otherwise semantic-release computes `v1.5.4` from the last reachable v1 tag, which already exists on
`master`.

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

- [check_latest_action_pin.mts](scripts/ops/check_latest_action_pin.mts): checks whether pinned GitHub Action
  refs are up to date against upstream releases.
- [create_testcase_logs.mts](scripts/dev/create_testcase_logs.mts): regenerates command execution logs used by
  integration/parser fixtures.
- [hotfix_pr.mts](scripts/dev/hotfix_pr.mts): automates hotfix branch creation and PR creation/update flow.
- [gh_sync.mts](scripts/dev/gh_sync.mts): synchronizes repository settings, rulesets, variables, and tags
  JSON. **These are not for source control** since they leak information.
- [setup_devenv.mts](scripts/dev/setup_devenv.mts): bootstraps local developer dependencies, workspace
  settings, and npm audit remediation.
- [node_ver.mts](scripts/dev/node_ver.mts): verifies or updates Node version alignment across repo files and
  local Node installation.

## Integration Test Notes

Integration test suite is [test/ubuntu.integration.test.ts](test/ubuntu.integration.test.ts).

- These tests execute real APT commands and are environment-sensitive.
- They are intentionally narrower than unit tests to keep runtime manageable.
- Mutating package operations should use locking for safety when applicable.

## Docs and Publishing

- API docs are generated into [docs/api](docs/api) and are generated during the release process, not committed
  to source.
- Release workflow publishes package artifacts and deploys docs via GitHub Pages.

## Operational Concerns

- Node.js baseline is managed in [package.json](package.json) engines.
- Keep `package-lock.json` committed and synchronized with dependency changes.
- Prefer updating workflow action SHAs with care and validate in CI.
- Prefer full commit SHA pinning for all third-party GitHub Actions.
- Repository settings, rulesets, variables, and tags are synchronized via `scripts/dev/gh_sync.mts`.
- Repository settings are tracked in [.github/repo-settings.json](.github/repo-settings.json) and can be
  applied with `npm run repo:settings:upload`.
- Repository rulesets are tracked in [.github/repo-rulesets.json](.github/repo-rulesets.json) and can be
  applied with `npm run repo:rulesets:upload`.
- Repository variables are tracked in `.github/repo-vars.json` and can be applied with
  `npm run repo:vars:upload`.
- Repository tags are tracked in `.github/repo-tags.json` and can be applied with `npm run repo:tags:upload`.
- Use `npm run repo:all:download` and `npm run repo:all:upload` to synchronize every tracked GitHub metadata
  target in one pass.
- Prefer explicit status checks and branch protections over informal merge discipline.
- Keep release automation branch-based and semantic-release driven.
